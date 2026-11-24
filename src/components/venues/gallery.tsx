import Image from "next/image";

type Photo = { id: string; imageUrl: string; altText: string };
export function VenuePhoto({
  src,
  alt,
  sizes,
  eager = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  eager?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fill
      unoptimized={src.startsWith("/api/venue-media/")}
      className="object-cover"
    />
  );
}

export function VenueGallery({ images }: { images: Photo[] }) {
  if (!images.length)
    return (
      <div className="grid min-h-56 place-items-center rounded-2xl bg-highlight text-muted">
        Photos will appear here.
      </div>
    );
  return (
    <div
      aria-label="Venue photos"
      tabIndex={images.length > 1 ? 0 : undefined}
      className="flex snap-x gap-2 overflow-x-auto rounded-2xl pb-2 md:grid md:snap-none md:grid-cols-4 md:overflow-visible"
    >
      {images.map((image, index) => (
        <div
          key={image.id}
          className={`relative aspect-[1.48] w-[86%] shrink-0 snap-start overflow-hidden rounded-xl bg-highlight md:w-full ${index === 0 ? "md:col-span-2 md:row-span-2" : ""} ${images.length === 1 ? "w-full md:col-span-4 md:aspect-[2.8]" : ""}`}
        >
          <VenuePhoto
            src={image.imageUrl}
            alt={image.altText}
            sizes={
              index === 0
                ? "(max-width: 768px) 86vw, 45vw"
                : "(max-width: 768px) 86vw, 24vw"
            }
            eager={index === 0}
          />
        </div>
      ))}
    </div>
  );
}
