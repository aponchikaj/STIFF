import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { VerifyClient } from "./verify-client";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { token } = await searchParams;

  return (
    <AuthShell
      title="Verify email"
      footer={[{ text: "Go to your", label: "Account", href: "/account" }]}
    >
      <VerifyClient token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
