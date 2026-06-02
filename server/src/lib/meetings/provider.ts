/**
 * meetings/provider.ts — create live meetings on Zoom or Microsoft Teams.
 *
 * Pluggable like the AI layer: a real provider when credentials are configured,
 * otherwise MANUAL (the host supplies the join URL). Request builders are pure
 * and exported for tests; the network calls are thin wrappers around them.
 *
 * - Zoom: Server-to-Server OAuth → POST /v2/users/{id}/meetings.
 * - Teams: client-credentials → Graph POST /v1.0/users/{id}/onlineMeetings.
 */
import { env } from "../../config/env.js";

export type Provider = "zoom" | "teams" | "manual";

export type CreateMeetingInput = { topic: string; startsAt: Date; durationMin: number };
export type CreatedMeeting = { provider: Provider; joinUrl: string; externalMeetingId: string | null };

export function configuredProvider(): Provider {
  if (env.MEETING_PROVIDER === "zoom" && env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET) return "zoom";
  if (env.MEETING_PROVIDER === "teams" && env.TEAMS_TENANT_ID && env.TEAMS_CLIENT_ID && env.TEAMS_CLIENT_SECRET && env.TEAMS_HOST_USER_ID) return "teams";
  return "manual";
}

// --- Zoom -------------------------------------------------------------------

export function buildZoomMeetingBody(input: CreateMeetingInput) {
  return {
    topic: input.topic,
    type: 2, // scheduled
    start_time: input.startsAt.toISOString(),
    duration: input.durationMin,
    settings: { join_before_host: false, waiting_room: true },
  };
}

async function zoomToken(): Promise<string> {
  const basic = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${env.ZOOM_ACCOUNT_ID}`, {
    method: "POST", headers: { authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Zoom OAuth ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function createZoomMeeting(input: CreateMeetingInput): Promise<CreatedMeeting> {
  const token = await zoomToken();
  const res = await fetch(`https://api.zoom.us/v2/users/${env.ZOOM_HOST_USER_ID}/meetings`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(buildZoomMeetingBody(input)),
  });
  if (!res.ok) throw new Error(`Zoom create ${res.status}`);
  const json = (await res.json()) as { id: number | string; join_url: string };
  return { provider: "zoom", joinUrl: json.join_url, externalMeetingId: String(json.id) };
}

// --- Teams (Microsoft Graph) ------------------------------------------------

export function buildTeamsMeetingBody(input: CreateMeetingInput) {
  return {
    subject: input.topic,
    startDateTime: input.startsAt.toISOString(),
    endDateTime: new Date(input.startsAt.getTime() + input.durationMin * 60_000).toISOString(),
  };
}

async function teamsToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.TEAMS_CLIENT_ID!, client_secret: env.TEAMS_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${env.TEAMS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
  });
  if (!res.ok) throw new Error(`Teams OAuth ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function createTeamsMeeting(input: CreateMeetingInput): Promise<CreatedMeeting> {
  const token = await teamsToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${env.TEAMS_HOST_USER_ID}/onlineMeetings`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(buildTeamsMeetingBody(input)),
  });
  if (!res.ok) throw new Error(`Teams create ${res.status}`);
  const json = (await res.json()) as { id: string; joinWebUrl: string };
  return { provider: "teams", joinUrl: json.joinWebUrl, externalMeetingId: json.id };
}

/**
 * Provision a meeting. For MANUAL (or when the requested provider lacks creds),
 * the caller-supplied `manualJoinUrl` is used.
 */
export async function provisionMeeting(
  requested: Provider, input: CreateMeetingInput, manualJoinUrl?: string,
): Promise<CreatedMeeting> {
  const provider = requested === "manual" ? "manual" : configuredProvider() === requested ? requested : "manual";
  if (provider === "zoom") return createZoomMeeting(input);
  if (provider === "teams") return createTeamsMeeting(input);
  if (!manualJoinUrl) throw new Error("manual_join_url_required");
  return { provider: "manual", joinUrl: manualJoinUrl, externalMeetingId: null };
}
