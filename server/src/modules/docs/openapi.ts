/**
 * openapi.ts — hand-authored OpenAPI 3.1 description of the documented,
 * version-stable REST surface (§8.3). It covers the programmatic-access contract
 * the spec mandates — learner enrolment/profile, completion + badge status, xAPI
 * statement data, Block 4 project records, certificate verification — plus the
 * OAuth 2.0 / bearer security schemes. Served at /api/v1/openapi.json.
 */
import { env } from "../../config/env.js";

const ok = (description: string) => ({
  200: { description, content: { "application/json": { schema: { type: "object", properties: { data: {} } } } } },
});

export function openapiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "KD-HCBLM API",
      version: "2.0.0",
      description:
        "Kompetences Declick — Human Competency-Based Learning Model. Documented, " +
        "version-stable REST API. All paths are prefixed with /api/v1. Responses are " +
        "enveloped as { data }. Errors are { error, message }.",
    },
    servers: [{ url: `${env.PUBLIC_BASE_URL}/api/v1` }],
    security: [{ bearerAuth: [] }, { oauth2: ["openid"] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        oauth2: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: `${env.AUTH_ISSUER}/authorize`,
              tokenUrl: `${env.PUBLIC_BASE_URL}/api/v1/auth/token`,
              scopes: { openid: "OpenID Connect", profile: "Profile" },
            },
          },
        },
      },
    },
    tags: [
      { name: "Auth" }, { name: "Enrolments" }, { name: "Progress" },
      { name: "Certification" }, { name: "Credentials" }, { name: "xAPI / LRS" },
      { name: "Webhooks" }, { name: "Analytics" }, { name: "Export" },
    ],
    paths: {
      "/auth/token": {
        post: { tags: ["Auth"], summary: "OAuth 2.0 token endpoint (password / refresh grants)", security: [], responses: ok("Token issued") },
      },
      "/enrollments": {
        get: { tags: ["Enrolments"], summary: "List the caller's enrolments (course, status, progress)", responses: ok("Enrolment list") },
        post: { tags: ["Enrolments"], summary: "Enrol a learner in a course", responses: { 201: { description: "Enrolment created" } } },
      },
      "/enrollments/{id}": {
        get: {
          tags: ["Enrolments"], summary: "Enrolment + full progress map, badges, PAM status",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: ok("Enrolment with progress"),
        },
      },
      "/enrollments/{id}/transcript": {
        get: {
          tags: ["Progress"], summary: "Official learner transcript — completion, scores, badges, credentials",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: ok("Transcript"),
        },
      },
      "/enrollments/{id}/project": {
        get: {
          tags: ["Certification"], summary: "Block 4 certification-project record (full verification metadata)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: ok("Project submission record"),
        },
      },
      "/enrollments/{id}/project/assign": {
        post: {
          tags: ["Certification"], summary: "Assign an evaluator to a Block 4 project (admin)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: ok("Evaluator assigned"),
        },
      },
      "/enrollments/{id}/evaluation": {
        post: {
          tags: ["Certification"], summary: "Record the per-criterion rubric evaluation (evaluator)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: ok("Evaluation recorded"),
        },
      },
      "/enrollments/{id}/xapi": {
        get: {
          tags: ["xAPI / LRS"], summary: "xAPI statements for one enrolment",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: ok("Statements"),
        },
      },
      "/lrs/statements": {
        get: {
          tags: ["xAPI / LRS"],
          summary: "Query stored xAPI statements by learner, course, date range and verb",
          parameters: [
            { name: "learnerId", in: "query", schema: { type: "string" } },
            { name: "courseId", in: "query", schema: { type: "string" } },
            { name: "verb", in: "query", schema: { type: "string" } },
            { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "until", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: ok("Statements page"),
        },
      },
      "/credentials/{id}/verify": {
        get: {
          tags: ["Credentials"], summary: "Verify a credential / certificate (public)", security: [],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: ok("Verification result"),
        },
      },
      "/webhooks": {
        get: { tags: ["Webhooks"], summary: "List webhook subscriptions (admin)", responses: ok("Subscriptions") },
        post: { tags: ["Webhooks"], summary: "Register a webhook subscription (admin)", responses: { 201: { description: "Created" } } },
      },
      "/analytics/courses/{courseId}": {
        get: {
          tags: ["Analytics"], summary: "Course report + Block 4 completion forecast (date-range filterable)",
          parameters: [
            { name: "courseId", in: "path", required: true, schema: { type: "string" } },
            { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "until", in: "query", schema: { type: "string", format: "date-time" } },
          ],
          responses: ok("Course report"),
        },
      },
      "/courses/{id}/export": {
        get: {
          tags: ["Export"], summary: "Export a course (scorm12 | scorm2004 | cmi5 | cc)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "format", in: "query", schema: { type: "string", enum: ["scorm12", "scorm2004", "cmi5", "cc"] } },
          ],
          responses: { 200: { description: "Package archive", content: { "application/zip": {} } } },
        },
      },
    },
  };
}

/** Minimal Redoc viewer (renders the spec client-side; CDN-hosted bundle). */
export const DOCS_HTML = `<!doctype html><html><head><meta charset="utf-8"/>
<title>KD-HCBLM API</title><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>body{margin:0}</style></head><body>
<redoc spec-url="./openapi.json"></redoc>
<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body></html>`;
