import "server-only";
import { cache } from "react";
import { getServerSession, type NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import Credentials from "next-auth/providers/credentials";
import Google, { type GoogleProfile } from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import {
  audit,
  findSessionUser,
  findProfile,
} from "@/modules/users/repository";
import { email as emailSchema, loginSchema } from "@/modules/auth/schemas";
import { authorizeGoogleAccount } from "@/modules/auth/oauth";
import { authenticate } from "@/modules/auth/service";
import { limitAttempt } from "@/modules/auth/rate-limit";
import { AppError } from "./api";
import { databaseConnectionErrorCode, errorCode } from "./database-errors";
import { getEnv } from "./env";
import { log } from "./log";
import { getPrisma } from "./prisma";
import { dashboardPath } from "@/config/navigation";

const invalidSessionCodes = new Set([
  "ERR_JWE_DECRYPTION_FAILED",
  "ERR_JWE_INVALID",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
]);

export function authOptions(request?: NextRequest): NextAuthOptions {
  const env = getEnv();
  const database = getPrisma();
  const adapter = PrismaAdapter(database);
  const optionsAdapter: Adapter = {
    ...adapter,
    // OAuth identities are provisioned atomically after Auth.js validates the provider response.
    createUser: async () => {
      throw new Error("OAuth identity provisioning was incomplete.");
    },
    linkAccount: async () => {
      throw new Error("Explicit OAuth account linking is required.");
    },
  };

  return {
    adapter: optionsAdapter,
    secret: env.AUTH_SECRET,
    useSecureCookies: env.APP_URL.startsWith("https:"),
    session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
    pages: { signIn: "/login", error: "/login" },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, request) {
          const parsed = loginSchema.safeParse(
            credentials && {
              email: credentials.email,
              password: credentials.password,
            },
          );
          if (!parsed.success) return null;
          try {
            await limitAttempt(
              "login",
              request.headers ?? {},
              parsed.data.email,
            );
            return await authenticate(parsed.data.email, parsed.data.password);
          } catch (error) {
            if (!(error instanceof AppError && error.status === 429)) {
              console.error("PitchMate credentials authentication unavailable");
            }
            return null;
          }
        },
      }),
      ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
        ? [
            Google({
              clientId: env.AUTH_GOOGLE_ID,
              clientSecret: env.AUTH_GOOGLE_SECRET,
              checks: ["pkce", "state"],
              allowDangerousEmailAccountLinking: false,
            }),
          ]
        : []),
    ],
    callbacks: {
      async signIn({ account, profile, user }) {
        if (account?.provider !== "google")
          return account?.provider === "credentials";
        const verifiedEmail = emailSchema.safeParse(user.email);
        if (
          (profile as GoogleProfile | undefined)?.email_verified !== true ||
          !verifiedEmail.success
        )
          return false;
        try {
          if (
            request &&
            (await getToken({ req: request, secret: env.AUTH_SECRET }))
          )
            return false;
          return await authorizeGoogleAccount(
            account.providerAccountId,
            verifiedEmail.data,
            user.name,
          );
        } catch {
          console.error("PitchMate Google authentication unavailable");
          return false;
        }
      },
      async jwt({ token, user, account }) {
        if (!user) return token;
        const sessionVersion =
          account?.provider === "credentials"
            ? user.sessionVersion
            : (await findSessionUser(user.id))?.sessionVersion;
        return { sub: user.id, sessionVersion };
      },
      async session({ session, token }) {
        if (!token.sub || typeof token.sessionVersion !== "number")
          return { expires: session.expires };
        const user = await findSessionUser(token.sub).catch(
          (error: unknown) => {
            const code = databaseConnectionErrorCode(error);
            if (!code) throw error;
            // Deny access until the session can be validated without discarding its cookie.
            log("warn", "auth.session_store_unavailable", { code });
            return null;
          },
        );
        if (
          !user ||
          user.status !== "ACTIVE" ||
          !user.emailVerified ||
          user.sessionVersion !== token.sessionVersion
        ) {
          return { expires: session.expires };
        }
        return {
          expires: session.expires,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
          },
        };
      },
    },
    events: {
      async signIn({ user, account }) {
        if (account?.provider === "google")
          await audit(database, user.id, "GOOGLE_AUTHENTICATED");
      },
      async signOut({ token }) {
        if (!token?.sub) return;
        try {
          const user = await findSessionUser(token.sub);
          if (user) await audit(database, user.id, "SIGNED_OUT");
        } catch {
          console.error("PitchMate sign-out audit unavailable");
        }
      },
    },
    logger: {
      error(code, metadata) {
        const detail = errorCode(
          metadata && typeof metadata === "object" && "error" in metadata
            ? metadata.error
            : metadata,
        );
        if (
          code === "JWT_SESSION_ERROR" &&
          detail &&
          invalidSessionCodes.has(detail)
        ) {
          log("info", "auth.session_cookie_rejected", { code: detail });
          return;
        }
        log("error", "auth.error", { code });
      },
      warn(code) {
        log("warn", "auth.warning", { code });
      },
    },
  };
}

export const currentUser = cache(
  async () => (await getServerSession(authOptions()))?.user ?? null,
);

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return user;
}

export function assertRole(user: { role: UserRole }, role: UserRole) {
  if (user.role !== role)
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have access to this resource.",
    );
}

export function assertOwnership(user: { id: string }, resourceOwnerId: string) {
  if (user.id !== resourceOwnerId)
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have access to this resource.",
    );
}

export async function requireApprovedOwner() {
  const user = await requireUser();
  assertRole(user, "OWNER");
  const profile = await findProfile(user.id);
  if (profile?.ownerProfile?.verificationStatus !== "APPROVED") {
    throw new AppError(
      403,
      "OWNER_APPROVAL_REQUIRED",
      "Your owner account must be approved.",
    );
  }
  return user;
}

export async function requireDashboardRole(role: UserRole) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(dashboardPath[user.role]);
  return user;
}
