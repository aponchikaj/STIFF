import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { safeNext } from "@/lib/safe-next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Register",
  robots: { index: false },
};

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { email, next } = await searchParams;
  // Same guard the login page uses, and for the same reason — see `safeNext`.
  const target = safeNext(next);

  return (
    <AuthShell
      title="Join Stiff"
      footer={[
        {
          text: "Already have an account?",
          label: "Log in",
          href: `/login?next=${encodeURIComponent(target)}`,
        },
      ]}
    >
      <RegisterForm
        defaultEmail={typeof email === "string" ? email : ""}
        next={target}
      />
    </AuthShell>
  );
}
