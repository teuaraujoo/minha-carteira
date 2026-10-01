import { AppShell } from "@/components/app-shell";

export default function AccountsPage() {
  return (
    <AppShell>
      <section aria-label="Contas" className="max-w-3xl">
        <p className="text-muted-foreground">
          Gerencie suas contas financeiras, saldos e carteiras em um só lugar.
        </p>
      </section>
    </AppShell>
  );
}
