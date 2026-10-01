import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell>
      <section aria-labelledby="overview-heading" className="space-y-3">
        <h1 id="overview-heading" className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground">Bem-vindo ao Minha Carteira. Seu controle financeiro começa aqui.</p>
      </section>
    </AppShell>
  );
}
