import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell>
      <section aria-label="Visão Geral" className="max-w-3xl">
        <p className="text-muted-foreground">Bem-vindo ao Minha Carteira. Seu controle financeiro começa aqui.</p>
      </section>
    </AppShell>
  );
}