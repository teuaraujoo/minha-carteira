import type { Metadata } from "next";

import { SmokeLogin } from "@/components/ui/smoke-login";

export const metadata: Metadata = {
  title: "Entrar | Minha Carteira",
  description: "Acesse sua conta do Minha Carteira.",
};

export default function LoginPage() {
  return <SmokeLogin defaultTheme="light" />;
}
