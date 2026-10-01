import { AppShell } from "@/components/app-shell";

export default function Page() {
  return (
    <AppShell>
      <section aria-label="Categorias" className="max-w-3xl">
        <p className="text-muted-foreground">Organize suas movimentações por categorias.</p>
      </section>
    </AppShell>
  );
}