/**
 * keys.ts — ES256 signing keys, JWKS, and rotation support.
 *
 * Signing uses the CURRENT private key. Verification uses a local JWK set that
 * includes the current public key plus an optional PREVIOUS public key, so
 * tokens minted before a rotation keep verifying until they expire. Keys come
 * from PEM env vars in production (stable `kid` across restarts); an ephemeral
 * keypair is generated for dev/test.
 *
 * Generate a keypair with `npm run keygen`. A KMS-backed signer can replace the
 * `privateKey` source without touching callers.
 */
import {
  generateKeyPair, importPKCS8, importSPKI, exportJWK, calculateJwkThumbprint,
  createLocalJWKSet, type KeyLike, type JWK, type JWTVerifyGetKey,
} from "jose";
import { env } from "../../config/env.js";

const ALG = "ES256";

export type Keys = {
  privateKey: KeyLike;
  kid: string;
  publicJwks: { keys: JWK[] };
  verifyKey: JWTVerifyGetKey;
};

let cache: Promise<Keys> | undefined;

async function publicJwkFrom(key: KeyLike): Promise<JWK> {
  const jwk = await exportJWK(key);
  jwk.alg = ALG;
  jwk.use = "sig";
  jwk.kid = await calculateJwkThumbprint(jwk);
  return jwk;
}

export function getKeys(): Promise<Keys> {
  cache ??= (async () => {
    let privateKey: KeyLike;
    let publicKey: KeyLike;
    if (env.AUTH_JWT_PRIVATE_KEY_PEM && env.AUTH_JWT_PUBLIC_KEY_PEM) {
      privateKey = await importPKCS8(env.AUTH_JWT_PRIVATE_KEY_PEM, ALG);
      publicKey = await importSPKI(env.AUTH_JWT_PUBLIC_KEY_PEM, ALG);
    } else {
      const pair = await generateKeyPair(ALG, { extractable: true });
      privateKey = pair.privateKey;
      publicKey = pair.publicKey;
    }
    const currentJwk = await publicJwkFrom(publicKey);

    const keys: JWK[] = [currentJwk];
    if (env.AUTH_JWT_PREVIOUS_PUBLIC_KEY_PEM) {
      const prev = await importSPKI(env.AUTH_JWT_PREVIOUS_PUBLIC_KEY_PEM, ALG);
      const prevJwk = await publicJwkFrom(prev);
      if (prevJwk.kid !== currentJwk.kid) keys.push(prevJwk);
    }

    return {
      privateKey,
      kid: currentJwk.kid!,
      publicJwks: { keys },
      verifyKey: createLocalJWKSet({ keys }),
    };
  })();
  return cache;
}

export async function publicJwks(): Promise<{ keys: JWK[] }> {
  return (await getKeys()).publicJwks;
}

export { ALG as JWT_ALG };
