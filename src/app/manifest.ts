import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PitchMate Cricket Turf Booking",
    short_name: "PitchMate",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#16845b",
    icons: [192, 512].map((size) => ({
      src: `/logo/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  };
}
