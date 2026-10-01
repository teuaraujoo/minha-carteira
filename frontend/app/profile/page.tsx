import { AppShell } from "@/components/app-shell";

export default function Page() {
  return (
    <AppShell>
      <section aria-label="Perfil" className="max-w-3xl">
        <p className="text-muted-foreground">Consulte e gerencie as informações do seu perfil.</p>
      </section>
    </AppShell>
  );
}