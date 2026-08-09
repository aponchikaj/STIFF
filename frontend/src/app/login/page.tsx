import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/account";

  return (
    <AuthShell
      title="Log in"
      footer={[
        { text: "No account yet?", label: "Register", href: "/register" },
        {
          text: "Forgot your password?",
          label: "Reset it",
          href: "/forgot-password",
        },
      ]}
    >
      <LoginForm next={target} />
    </AuthShell>
  );
}
