import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LoginForm />;
}
