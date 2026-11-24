import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { venueSettings } from "@/modules/venues/settings";

const localDir = () => process.env.PITCHMATE_MEDIA_DIR || ".pitchmate-media";
const localPath = (id: string) =>
  join(localDir(), `${z.uuid().parse(id)}.webp`);

export function storageKey(id: string) {
  if (venueSettings().CLOUDINARY_CLOUD_NAME)
    return `cloudinary:pitchmate/${id}`;
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(getEnv().APP_URL).hostname,
    )
  )
    throw new AppError(
      503,
      "STORAGE_UNCONFIGURED",
      "Image storage is temporarily unavailable.",
    );
  return `local:${id}`;
}

async function cloudinary(
  action: "upload" | "destroy",
  publicId: string,
  bytes?: Uint8Array<ArrayBuffer>,
) {
  const {
    CLOUDINARY_CLOUD_NAME: name,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: secret,
  } = venueSettings();
  if (!name || !apiKey || !secret)
    throw new AppError(
      503,
      "STORAGE_UNCONFIGURED",
      "Image storage is temporarily unavailable.",
    );
  if (!/^pitchmate\/[a-f0-9-]{36}$/.test(publicId))
    throw new Error("Invalid storage key.");
  const values = {
    ...(action === "upload" ? { overwrite: "false" } : { invalidate: "true" }),
    public_id: publicId,
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };
  const signature = createHash("sha256")
    .update(
      Object.entries(values)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("&") + secret,
    )
    .digest("hex");
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  body.set("api_key", apiKey);
  body.set("signature", signature);
  if (bytes)
    body.set("file", new Blob([bytes], { type: "image/webp" }), "venue.webp");
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${name}/image/${action}`,
      { method: "POST", body, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) throw new Error("Storage request failed.");
    return (await response.json()) as unknown;
  } catch {
    throw new AppError(
      502,
      "STORAGE_REQUEST_FAILED",
      "Image storage could not complete the request.",
    );
  }
}

export async function putImage(key: string, bytes: Uint8Array<ArrayBuffer>) {
  if (key.startsWith("local:")) {
    const id = key.slice(6);
    await mkdir(localDir(), { recursive: true, mode: 0o700 });
    await writeFile(localPath(id), bytes, { flag: "wx", mode: 0o600 });
    return `/api/venue-media/${id}`;
  }
  const result = z
    .object({
      secure_url: z.url({
        protocol: /^https$/,
        hostname: /^res\.cloudinary\.com$/,
      }),
    })
    .parse(await cloudinary("upload", key.slice("cloudinary:".length), bytes));
  return result.secure_url;
}

export async function removeStoredImage(key: string) {
  if (key.startsWith("local:")) {
    try {
      await unlink(localPath(key.slice(6)));
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
  } else if (key.startsWith("cloudinary:")) {
    const { result } = z
      .object({ result: z.enum(["ok", "not found"]) })
      .parse(await cloudinary("destroy", key.slice("cloudinary:".length)));
    return result;
  }
}
export const readLocalImage = (id: string) => readFile(localPath(id));
