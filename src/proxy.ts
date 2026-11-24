import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const strict = process.env.CSP_MODE === "enforce";
  const nonce = strict
    ? Buffer.from(crypto.randomUUID()).toString("base64")
    : undefined;
  const development = process.env.NODE_ENV !== "production";
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"} https://checkout.razorpay.com https://cdn.razorpay.com${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.razorpay.com",
    "font-src 'self' data:",
    `connect-src 'self' https://*.razorpay.com${development ? " ws:" : ""}`,
    "frame-src 'self' https://*.razorpay.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
  const incoming = new Headers(request.headers);
  incoming.delete("x-csp-nonce");
  if (nonce) {
    incoming.set("x-csp-nonce", nonce);
    incoming.set("Content-Security-Policy", policy);
  }
  const response = NextResponse.next({ request: { headers: incoming } });
  response.headers.set(
    strict ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    policy,
  );
  if (strict) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
