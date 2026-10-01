import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Minha Carteira - Gerenciador de Finanças Pessoais",
  description: "Controle de finanças pessoais, transações, categorias e orçamentos",
  applicationName: "Minha Carteira",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={cn("h-full antialiased font-sans", geistSans.variable, geistMono.variable, figtree.variable)}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
