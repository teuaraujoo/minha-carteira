import type { Metadata } from "next";

import { SmokeMfaVerify } from "@/components/ui/smoke-mfa-verify";

export const metadata: Metadata = {
  title: "Verificar código | Minha Carteira",
  description: "Valide o código de verificação enviado para o seu e-mail.",
};

type MfaVerifyPageProps = {
  searchParams: Promise<{ email?: string | string[] }>;
};

export default async function MfaVerifyPage({
  searchParams,
}: MfaVerifyPageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : undefined;

  return <SmokeMfaVerify email={email} defaultTheme="light" />;
}
