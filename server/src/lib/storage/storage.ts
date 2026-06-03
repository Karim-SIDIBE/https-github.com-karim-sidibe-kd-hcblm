/**
 * storage.ts — pluggable object storage for media.
 *
 * Local filesystem provider (default; works in any environment). The interface
 * mirrors what an S3/R2/GCS provider needs (put / stat / read / readRange /
 * remove / publicUrl), so swapping in a cloud provider is a drop-in.
 */
import { createWriteStream, createReadStream, type ReadStream } from "node:fs";
import { mkdir, stat, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { env } from "../../config/env.js";

const ROOT = resolve(env.MEDIA_DIR);

function pathFor(key: string): string {
  // Prevent traversal; keys are app-generated but be defensive.
  const safe = key.replace(/\.\.+/g, "").replace(/^\/+/, "");
  return join(ROOT, safe);
}

export async function put(key: string, data: Readable | Buffer): Promise<{ sizeBytes: number }> {
  const dest = pathFor(key);
  await mkdir(dirname(dest), { recursive: true });
  const source = Buffer.isBuffer(data) ? Readable.from(data) : data;
  let sizeBytes = 0;
  source.on("data", (c: Buffer) => (sizeBytes += c.length));
  await pipeline(source, createWriteStream(dest));
  return { sizeBytes };
}

export async function sizeOf(key: string): Promise<number> {
  return (await stat(pathFor(key))).size;
}

export function read(key: string): ReadStream {
  return createReadStream(pathFor(key));
}

export function readRange(key: string, start: number, end: number): ReadStream {
  return createReadStream(pathFor(key), { start, end });
}

export async function remove(key: string): Promise<void> {
  await rm(pathFor(key), { force: true });
}

/** Filesystem path for a key (local provider only; used by the ffmpeg transcoder). */
export function localPath(key: string): string {
  return pathFor(key);
}

/** A public URL when a CDN base is configured, else an app-served path. */
export function publicUrl(key: string): string {
  if (env.MEDIA_PUBLIC_BASE_URL) return `${env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  return `/api/v1/media/file/${encodeURIComponent(key)}`;
}
