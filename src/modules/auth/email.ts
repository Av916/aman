import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getEnv } from "@/lib/env";
import { after } from "next/server";

export type AccountEmail = {
  email: string;
  raw: string;
  kind: "reset" | "verify";
};

export function accountEmailLink({ raw, kind }: AccountEmail) {
  return new URL(
    `/${kind === "reset" ? "reset-password" : "verify-email"}#token=${raw}`,
    getEnv().APP_URL,
  ).href;
}

async function sendAccountEmail(message: AccountEmail) {
  const env = getEnv();
  const link = accountEmailLink(message);
  const subject =
    message.kind === "reset"
      ? "Reset your PitchMate password"
      : "Verify your PitchMate email";
  const text = `${subject}\n\n${link}\n\nIf you did not request this, you can ignore this message.`;
  if (!env.EMAIL_PROVIDER_API_KEY) {
    const directory = process.env.PITCHMATE_MAIL_DIR || ".pitchmate-mail";
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const messageFile = join(directory, `${randomUUID()}.json`);
    const pendingFile = `${messageFile}.pending`;
    await writeFile(
      pendingFile,
      JSON.stringify({ to: message.email, subject, link, text }),
      { mode: 0o600, flag: "wx" },
    );
    await rename(pendingFile, messageFile);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.email],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Email provider rejected the message.");
}

export function deliverAfterResponse(message: AccountEmail | undefined) {
  if (!message) return;
  after(async () => {
    try {
      await sendAccountEmail(message);
    } catch {
      console.error("PitchMate account email delivery failed", {
        kind: message.kind,
      });
    }
  });
}
