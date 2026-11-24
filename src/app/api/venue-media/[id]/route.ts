import { AppError, endpoint } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { readLocalImage } from "@/modules/media/storage";
import { idSchema } from "@/modules/venues/venue.validation";

export const GET = endpoint(
  async (_r: Request, { params }: { params: Promise<{ id: string }> }) => {
    const id = idSchema.parse((await params).id);
    const venueImage = await getPrisma().venueImage.findUnique({
      where: { id },
      select: {
        storageKey: true,
        venue: {
          select: {
            ownerId: true,
            status: true,
            deletedAt: true,
            publishedAt: true,
          },
        },
      },
    });
    const missing = () =>
      new AppError(404, "IMAGE_NOT_FOUND", "Image not found.");
    if (venueImage?.storageKey !== `local:${id}`) throw missing();
    const { venue } = venueImage;
    if (venue.status !== "APPROVED" || !venue.publishedAt || venue.deletedAt) {
      const user = await currentUser();
      if (user?.role !== "ADMIN" && user?.id !== venue.ownerId) throw missing();
    }
    try {
      const bytes = await readLocalImage(id);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      throw missing();
    }
  },
);
