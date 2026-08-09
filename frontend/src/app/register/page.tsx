import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register — STIFF" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Join Stiff"
      footer={[{ text: "Already have an account?", label: "Log in", href: "/login" }]}
    >
      <RegisterForm />
    </AuthShell>
  );
}
