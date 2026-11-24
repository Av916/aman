import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { StaffAcceptance } from "@/components/operations/management";
export const metadata = { title: "Staff invitation" };
export default async function Page() {
  const actor = await currentUser();
  return (
    <main className="mx-auto grid max-w-xl gap-6 p-6 sm:pt-20">
      <h1 className="text-3xl font-bold">Join a PitchMate venue team</h1>
      {actor ? (
        <StaffAcceptance />
      ) : (
        <p>
          <Link href="/login" className="font-bold underline">
            Sign in
          </Link>{" "}
          with the invited email address, then reopen the original invitation
          link.
        </p>
      )}
    </main>
  );
}
