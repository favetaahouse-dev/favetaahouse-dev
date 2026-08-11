import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RegisterForm />;
}
