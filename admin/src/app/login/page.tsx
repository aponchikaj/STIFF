import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <section className="flex min-h-dvh w-full items-center justify-center px-4 py-16">
      <LoginForm />
    </section>
  );
}
