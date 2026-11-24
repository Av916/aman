import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  if (process.env.APP_ENV === "staging")
    return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      disallow: [
        "/api/",
        "/admin/",
        "/owner/",
        "/staff/",
        "/account",
        "/dashboard",
        "/bookings/",
        "/checkout/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/resend-verification",
      ],
    },
    sitemap: new URL("/sitemap.xml", getEnv().APP_URL).href,
  };
}
