import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { VerifyForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Verify your email" };

// Reading searchParams is dynamic; with Cache Components enabled it must sit inside a
// Suspense boundary so the rest of the route can still prerender.
async function VerifyInner({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <VerifyForm initialEmail={email ?? ""} />;
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <VerifyInner searchParams={searchParams} />
    </Suspense>
  );
}
