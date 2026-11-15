import type { Metadata } from "next";

import { SmokeRegister } from "@/components/ui/smoke-register";

export const metadata: Metadata = {
  title: "Criar conta | Minha Carteira",
  description: "Crie sua conta no Minha Carteira para organizar suas finanças.",
};

type RegisterPageProps = {
  searchParams: Promise<{ email?: string | string[] }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : undefined;

  return <SmokeRegister initialEmail={email} defaultTheme="light" />;
}
