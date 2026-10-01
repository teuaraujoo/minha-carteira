import { AppShell } from "@/components/app-shell";

export default function Page() {
  return (
    <AppShell>
      <section aria-label="Transações" className="max-w-3xl">
        <p className="text-muted-foreground">Acompanhe suas receitas e despesas em um só lugar.</p>
      </section>
    </AppShell>
  );
}