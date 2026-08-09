import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password — STIFF" };

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
