import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      footer={[{ text: "Remembered it?", label: "Log in", href: "/login" }]}
    >
      <ForgotForm />
    </AuthShell>
  );
}
