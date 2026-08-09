import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "New password",
  robots: { index: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams;

  return (
    <AuthShell
      title="New password"
      footer={[{ text: "Back to", label: "Log in", href: "/login" }]}
    >
      <ResetForm token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
