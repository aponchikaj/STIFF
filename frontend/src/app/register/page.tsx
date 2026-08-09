import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Register",
  robots: { index: false },
};

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { email } = await searchParams;

  return (
    <AuthShell
      title="Join Stiff"
      footer={[{ text: "Already have an account?", label: "Log in", href: "/login" }]}
    >
      <RegisterForm defaultEmail={typeof email === "string" ? email : ""} />
    </AuthShell>
  );
}
