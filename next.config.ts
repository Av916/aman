import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(process.env.CONTAINER_BUILD === "1" ? { output: "standalone" } : {}),
  images: {
    remotePatterns: process.env.CLOUDINARY_CLOUD_NAME
      ? [
          {
            protocol: "https",
            hostname: "res.cloudinary.com",
            pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/**`,
            search: "",
          },
        ]
      : [],
    maximumRedirects: 0,
  },
  async headers() {
    return [
      {
        source:
          "/:scope(admin|owner|account|dashboard|bookings|checkout|staff|login|register|register-owner|forgot-password|reset-password|verify-email|resend-verification)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value:
              "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          },
          ...(process.env.APP_URL?.startsWith("https:")
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
