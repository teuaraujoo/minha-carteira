import { AppShell } from "@/components/app-shell";

export default function Page() {
  return (
    <AppShell>
      <section aria-label="Orçamentos" className="max-w-3xl">
        <p className="text-muted-foreground">Acompanhe o planejamento dos seus gastos.</p>
      </section>
    </AppShell>
  );
}