import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { getEnv } from "@/lib/env";

type Context = { params: Promise<{ nextauth: string[] }> };

async function handler(request: NextRequest, context: Context) {
  process.env.NEXTAUTH_URL = getEnv().APP_URL;
  return NextAuth(authOptions(request))(request, {
    params: await context.params,
  });
}

export { handler as GET, handler as POST };
