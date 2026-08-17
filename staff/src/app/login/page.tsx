import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <AuthShell title="Log in">
      <p className="mb-8 max-w-sm text-sm leading-6 text-muted">
        Invite only. An owner creates your account — there is no public
        registration.
      </p>
      <LoginForm />
    </AuthShell>
  );
}
