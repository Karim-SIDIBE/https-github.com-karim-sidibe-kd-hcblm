/**
 * keygen.ts — generate an ES256 keypair (PEM) for JWT signing.
 *
 * Usage:  npx tsx scripts/keygen.ts
 * Copy the printed PEMs into AUTH_JWT_PRIVATE_KEY_PEM / AUTH_JWT_PUBLIC_KEY_PEM
 * (single-line with \n escapes for .env). During rotation, move the OUTGOING
 * public key to AUTH_JWT_PREVIOUS_PUBLIC_KEY_PEM before swapping in the new pair.
 */
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";

const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
const priv = await exportPKCS8(privateKey);
const pub = await exportSPKI(publicKey);

const esc = (pem: string) => pem.trim().replace(/\n/g, "\\n");

console.log("# ES256 keypair for KD-HCBLM JWT signing\n");
console.log(`AUTH_JWT_PRIVATE_KEY_PEM="${esc(priv)}"`);
console.log(`AUTH_JWT_PUBLIC_KEY_PEM="${esc(pub)}"`);
