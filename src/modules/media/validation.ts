import sharp from "sharp";
import { z } from "zod";
import { AppError, assertSameOrigin } from "@/lib/api";
import { venueSettings } from "@/modules/venues/settings";
import { idSchema } from "@/modules/venues/venue.validation";

const altText = z.string().trim().min(3).max(160);
export const imageEdit = z
  .strictObject({
    altText: altText.optional(),
    isCover: z.literal(true).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Supply alt text or select this image as the cover.",
  );
export const imageOrder = z.strictObject({
  imageIds: z
    .array(idSchema)
    .min(1)
    .max(10)
    .refine(
      (items) => new Set(items).size === items.length,
      "List each image once.",
    ),
});

export async function optimizeImage(file: File) {
  const limit = venueSettings().MAX_IMAGE_SIZE_MB * 1024 * 1024;
  if (!file.size || file.size > limit)
    throw new AppError(
      413,
      "IMAGE_SIZE",
      "The image exceeds the allowed file size or is empty.",
    );
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 24_000_000,
      failOn: "error",
    });
    const info = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(info.format) ||
      (info.pages ?? 1) !== 1 ||
      (file.type &&
        !["application/octet-stream", `image/${info.format}`].includes(
          file.type,
        ))
    )
      throw new Error("Unsupported image format.");
    const bytes = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    return new Uint8Array(bytes);
  } catch {
    throw new AppError(
      422,
      "INVALID_IMAGE",
      "Upload a valid still JPEG, PNG or WebP image.",
    );
  }
}

export async function readImageUpload(request: Request) {
  assertSameOrigin(request);
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    throw new AppError(
      415,
      "UPLOAD_FORMAT",
      "Upload an image using multipart form data.",
    );
  const limit = venueSettings().MAX_IMAGE_SIZE_MB * 1024 * 1024 + 32_768;
  if (Number(request.headers.get("content-length")) > limit)
    throw new AppError(
      413,
      "IMAGE_SIZE",
      "The image exceeds the allowed file size.",
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError(400, "UPLOAD_FORMAT", "Choose an image to upload.");
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(
        413,
        "IMAGE_SIZE",
        "The image exceeds the allowed file size.",
      );
    }
    parts.push(new Uint8Array(value));
  }
  let form: FormData;
  try {
    form = await new Response(new Blob(parts), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new AppError(
      400,
      "UPLOAD_FORMAT",
      "The image upload could not be read.",
    );
  }
  const files = form.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File))
    throw new AppError(
      422,
      "UPLOAD_FORMAT",
      "Choose exactly one image per upload.",
    );
  return { file: files[0], altText: altText.parse(form.get("altText")) };
}
