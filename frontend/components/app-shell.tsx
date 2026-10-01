"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeftRight, ChartPie, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Settings, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigationItems = [
  { label: "Visão Geral", href: "/", icon: LayoutDashboard },
  { label: "Transações", href: "/transactions", icon: ArrowLeftRight },
  { label: "Categorias", href: "/categories", icon: Tags },
  { label: "Orçamentos", href: "/budgets", icon: ChartPie },
  { label: "Configurações", href: "/settings", icon: Settings },
];

// Opt in from page or route-group layouts; public pages and 404 remain independent.
// This visual shell does not validate or replace the server-side session.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const activeItem = navigationItems.find(({ href }) =>
    href === "/" ? pathname === href : pathname === href || pathname?.startsWith(href + "/")
  );

  return (
    <div className="min-h-dvh bg-background md:flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground">
        Ir para o conteúdo
      </a>
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <Link href="/" aria-label="Minha Carteira — início">
          <Image src="/logo.png" alt="Minha Carteira" width={2048} height={768} className="h-auto w-44" priority />
        </Link>
        <Button variant="ghost" className="motion-reduce:transition-none" size="icon" aria-label={mobileOpen ? "Fechar navegação" : "Abrir navegação"} aria-expanded={mobileOpen} aria-controls="app-navigation" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </header>
      <aside id="app-navigation" className={cn("border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto md:shrink-0 md:flex-col md:border-r md:border-b-0", mobileOpen ? "block" : "hidden", collapsed ? "md:w-20" : "md:w-64")}>
        <div className="hidden h-24 items-center justify-center border-b border-sidebar-border px-4 md:flex">
          <Link href="/" aria-label="Minha Carteira — início">
            {collapsed ? <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">MC</span> : <Image src="/logo.png" alt="Minha Carteira" width={2048} height={768} className="h-auto w-52" priority />}
          </Link>
        </div>
        <nav aria-label="Navegação principal" className="flex flex-col gap-2 p-3">
          {navigationItems.map(({ label, href, icon: Icon }) => {
            const active = activeItem?.href === href;
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={label} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)} className={cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring", active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "md:justify-center")}>
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className={cn(collapsed && "md:sr-only")}>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-sidebar-border p-3 md:block">
          <Button variant="ghost" className="w-full motion-reduce:transition-none" aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} aria-expanded={!collapsed} aria-controls="app-navigation" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <><PanelLeftClose aria-hidden="true" /><span>Recolher menu</span></>}
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-20 items-center border-b bg-card px-4 md:px-8">
          <p className="text-sm font-medium text-muted-foreground">{activeItem?.label ?? "Minha Carteira"}</p>
        </div>
        <main id="main-content" tabIndex={-1} className="min-w-0 p-4 outline-none md:p-8">{children}</main>
      </div>
    </div>
  );
}
