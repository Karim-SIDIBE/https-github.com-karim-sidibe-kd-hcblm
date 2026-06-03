import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuthRedirect, LTI } from "./lti.js";

test("auth redirect carries the required OIDC/LTI parameters", () => {
  const url = new URL(buildAuthRedirect({
    authLoginUrl: "https://lms.example/auth", clientId: "client-1", redirectUri: "https://tool/lti/launch",
    loginHint: "user-9", state: "st", nonce: "no", ltiMessageHint: "mh",
  }));
  assert.equal(url.origin + url.pathname, "https://lms.example/auth");
  const q = url.searchParams;
  assert.equal(q.get("scope"), "openid");
  assert.equal(q.get("response_type"), "id_token");
  assert.equal(q.get("response_mode"), "form_post");
  assert.equal(q.get("client_id"), "client-1");
  assert.equal(q.get("redirect_uri"), "https://tool/lti/launch");
  assert.equal(q.get("nonce"), "no");
  assert.equal(q.get("state"), "st");
  assert.equal(q.get("prompt"), "none");
  assert.equal(q.get("lti_message_hint"), "mh");
});

test("LTI claim URIs are the IMS spec ones", () => {
  assert.equal(LTI.messageType, "https://purl.imsglobal.org/spec/lti/claim/message_type");
  assert.equal(LTI.deploymentId, "https://purl.imsglobal.org/spec/lti/claim/deployment_id");
});
