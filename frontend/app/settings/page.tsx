import { AppShell } from "@/components/app-shell";

export default function Page() {
  return (
    <AppShell>
      <section aria-label="Configurações" className="max-w-3xl">
        <p className="text-muted-foreground">Gerencie as preferências da sua conta.</p>
      </section>
    </AppShell>
  );
}