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

const themeInitScript = `(function(){try{var s=localStorage.getItem("mc-theme");var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;var m=document.querySelector('meta[name="color-scheme"]');r.classList.toggle("dark",d);r.classList.toggle("light",!d);if(m&&(s==="light"||s==="dark"))m.setAttribute("content",s);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn("h-full antialiased font-sans", geistSans.variable, geistMono.variable, figtree.variable)}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
