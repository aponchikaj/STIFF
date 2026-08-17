import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <AuthShell title="Staff">
      <p className="mb-8 text-sm leading-6 text-muted">
        Accounts are created by an owner. There is no public registration.
      </p>
      <LoginForm />
    </AuthShell>
  );
}
