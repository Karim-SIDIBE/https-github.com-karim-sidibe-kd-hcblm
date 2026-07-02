/**
 * scim.service.ts — SCIM 2.0 user provisioning (RFC 7643/7644), per organization.
 *
 * An IdP (Okta / Entra ID / OneLogin) authenticates with the org's SCIM bearer
 * token and pushes Users; we map them to platform Users + OrganizationMemberships
 * in that tenant. Deactivation/delete removes the membership (the user remains
 * globally). Groups provisioning is a future extension.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";

const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const base = () => `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1`;

export class ScimError extends Error {
  constructor(public status: number, message: string, public scimType?: string) { super(message); }
}

/** Provision a SCIM bearer token for an org (returned once; only the hash stored). */
export async function provisionToken(organizationId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.organization.update({ where: { id: organizationId }, data: { scimTokenHash: sha256(token) } });
  return { token, endpoint: `${base()}/scim/v2` };
}

export async function orgFromToken(token: string) {
  const org = await prisma.organization.findFirst({ where: { scimTokenHash: sha256(token) } });
  if (!org) throw new ScimError(401, "Jeton SCIM invalide");
  return org;
}

type ScimUserBody = {
  userName?: string;
  externalId?: string;
  active?: boolean;
  name?: { formatted?: string; givenName?: string; familyName?: string };
  emails?: { value: string; primary?: boolean }[];
};

function displayName(b: ScimUserBody, email: string): string {
  if (b.name?.formatted) return b.name.formatted;
  const fn = [b.name?.givenName, b.name?.familyName].filter(Boolean).join(" ");
  return fn || email;
}
function emailOf(b: ScimUserBody): string {
  return b.userName || b.emails?.find((e) => e.primary)?.value || b.emails?.[0]?.value || "";
}

export function toScim(user: { id: string; email: string; name: string }, externalId?: string | null, active = true) {
  return {
    schemas: [USER_SCHEMA],
    id: user.id,
    ...(externalId ? { externalId } : {}),
    userName: user.email,
    name: { formatted: user.name },
    emails: [{ value: user.email, primary: true }],
    active,
    meta: { resourceType: "User", location: `${base()}/scim/v2/Users/${user.id}` },
  };
}

/** Create (provision) — find/create the user, ensure org membership.
 *
 * Tenant safety: an org's SCIM token must not be able to *adopt* a pre-existing
 * account it did not create. If a user with this e-mail already exists and is not
 * already a member of THIS org, we refuse when the account is privileged (any
 * non-LEARNER role), locally credentialed (self-registered / staff), or already
 * attached to another organization. We also never overwrite the global `name` of
 * a user this org did not create. */
export async function createUser(organizationId: string, body: ScimUserBody) {
  const email = emailOf(body);
  if (!email) throw new ScimError(400, "userName/emails requis", "invalidValue");

  const existing = await prisma.user.findUnique({ where: { email } });
  let userId: string;
  if (existing) {
    const memberHere = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId: existing.id } },
    });
    if (!memberHere) {
      if (existing.role !== "LEARNER" || existing.passwordHash) {
        throw new ScimError(409, "Un compte existe déjà pour cet e-mail et ne peut pas être provisionné via SCIM", "uniqueness");
      }
      const elsewhere = await prisma.organizationMembership.count({
        where: { userId: existing.id, organizationId: { not: organizationId } },
      });
      if (elsewhere > 0) throw new ScimError(409, "Ce compte est déjà rattaché à une autre organisation", "uniqueness");
    }
    userId = existing.id; // attach only — do NOT rename an account we didn't create
  } else {
    const created = await prisma.user.create({ data: { email, name: displayName(body, email), role: "LEARNER" } });
    userId = created.id;
  }

  const membership = await prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: { scimExternalId: body.externalId ?? undefined },
    create: { organizationId, userId, scimExternalId: body.externalId ?? null, orgRole: "MEMBER" },
  });
  const user = existing ?? (await prisma.user.findUnique({ where: { id: userId } }))!;
  return toScim(user, membership.scimExternalId, true);
}

async function memberOrThrow(organizationId: string, userId: string) {
  const m = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } }, include: { user: true },
  });
  if (!m) throw new ScimError(404, "Utilisateur non provisionné dans cette organisation");
  return m;
}

export async function getUser(organizationId: string, userId: string) {
  const m = await memberOrThrow(organizationId, userId);
  return toScim(m.user, m.scimExternalId, true);
}

export async function listUsers(organizationId: string, filter?: string) {
  const emailMatch = filter?.match(/userName eq "([^"]+)"/i);
  const members = await prisma.organizationMembership.findMany({
    where: { organizationId, ...(emailMatch ? { user: { email: emailMatch[1] } } : {}) },
    include: { user: true }, orderBy: { createdAt: "asc" },
  });
  const Resources = members.map((m) => toScim(m.user, m.scimExternalId, true));
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: Resources.length, startIndex: 1, itemsPerPage: Resources.length, Resources,
  };
}

/** Full replace (PUT) — update name; active:false deprovisions (removes membership). */
export async function replaceUser(organizationId: string, userId: string, body: ScimUserBody) {
  const m = await memberOrThrow(organizationId, userId);
  if (body.active === false) {
    await prisma.organizationMembership.delete({ where: { id: m.id } });
    return toScim(m.user, m.scimExternalId, false);
  }
  const user = await prisma.user.update({ where: { id: userId }, data: { name: displayName(body, m.user.email) } });
  if (body.externalId !== undefined) await prisma.organizationMembership.update({ where: { id: m.id }, data: { scimExternalId: body.externalId } });
  return toScim(user, body.externalId ?? m.scimExternalId, true);
}

type PatchOp = { op: string; path?: string; value?: unknown };

/** PATCH — handles the common `active` (deprovision) and name replacements. */
export async function patchUser(organizationId: string, userId: string, ops: PatchOp[]) {
  const m = await memberOrThrow(organizationId, userId);
  for (const op of ops) {
    if (op.op?.toLowerCase() !== "replace" && op.op?.toLowerCase() !== "add") continue;
    const path = (op.path ?? "").toLowerCase();
    const val = op.value;
    if (path === "active" || (path === "" && typeof val === "object" && val && "active" in (val as any))) {
      const active = path === "active" ? Boolean(val) : Boolean((val as any).active);
      if (!active) { await prisma.organizationMembership.delete({ where: { id: m.id } }); return toScim(m.user, m.scimExternalId, false); }
    }
    if (path === "name.formatted" && typeof val === "string") await prisma.user.update({ where: { id: userId }, data: { name: val } });
  }
  const fresh = await prisma.user.findUnique({ where: { id: userId } });
  return toScim(fresh!, m.scimExternalId, true);
}

export async function deleteUser(organizationId: string, userId: string) {
  const m = await memberOrThrow(organizationId, userId);
  await prisma.organizationMembership.delete({ where: { id: m.id } });
}

export function serviceProviderConfig() {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    patch: { supported: true }, bulk: { supported: false }, filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false }, sort: { supported: false }, etag: { supported: false },
    authenticationSchemes: [{ type: "oauthbearertoken", name: "OAuth Bearer Token", description: "Bearer token per organization" }],
  };
}
