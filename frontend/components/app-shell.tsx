"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Bell,
  ChartPie,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Tags,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigationItems = [
  { label: "Visão Geral", href: "/", icon: LayoutDashboard },
  { label: "Transações", href: "/transactions", icon: ArrowLeftRight },
  { label: "Categorias", href: "/categories", icon: Tags },
  { label: "Orçamentos", href: "/budgets", icon: ChartPie },
  { label: "Configurações", href: "/settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/profile": "Perfil",
};

const recentNotifications = [
  {
    title: "Bem-vindo ao Minha Carteira",
    detail: "Seu espaço financeiro está pronto para começar.",
  },
  {
    title: "Organize suas finanças",
    detail: "Adicione contas e acompanhe suas movimentações.",
  },
  {
    title: "Dica",
    detail: "Categorias ajudam a entender seus hábitos de consumo.",
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const activeItem = navigationItems.find(({ href }) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname?.startsWith(href + "/")
  );
  const pageTitle = activeItem?.label ?? pageTitles[pathname ?? ""] ?? "Minha Carteira";

  return (
    <div className="min-h-dvh bg-background md:flex">
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50",
          "focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        )}
      >
        Ir para o conteúdo
      </a>

      <aside
        id="app-navigation"
        className={cn(
          "border-b border-sidebar-border bg-sidebar text-sidebar-foreground",
          "md:sticky md:top-0 md:flex md:h-dvh md:shrink-0 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r",
          mobileOpen ? "block" : "hidden",
          collapsed ? "md:w-16" : "md:w-60"
        )}
      >
        <div className="hidden h-16 items-center justify-center border-b border-sidebar-border px-3 md:flex">
          <Link
            href="/"
            aria-label="Minha Carteira — início"
            className="flex items-center justify-center"
          >
            {collapsed ? (
              <Image
                src="/icon.png"
                alt=""
                width={36}
                height={36}
                className="size-8 object-contain"
                priority
              />
            ) : (
              <Image
                src="/logo.png"
                alt="Minha Carteira"
                width={2048}
                height={768}
                className="h-auto w-34"
                priority
              />
            )}
          </Link>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-col gap-1 p-2">
          {navigationItems.map(({ label, href, icon: Icon }) => {
            const active = activeItem?.href === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={collapsed ? label : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium outline-none transition-colors",
                  "motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "md:justify-center"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className={cn(collapsed && "md:sr-only")}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden border-t border-sidebar-border p-2 md:block">
          <Button
            variant="ghost"
            size="sm"
            className="w-full motion-reduce:transition-none"
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-expanded={!collapsed}
            aria-controls="app-navigation"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose aria-hidden="true" />
                <span>Recolher menu</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between gap-3 bg-transparent px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 md:hidden motion-reduce:transition-none"
              aria-label={mobileOpen ? "Fechar navegação" : "Abrir navegação"}
              aria-expanded={mobileOpen}
              aria-controls="app-navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </Button>
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
              {pageTitle}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <details className="group relative">
              <summary
                className={cn(
                  "flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-muted-foreground",
                  "outline-none transition-colors hover:bg-accent hover:text-foreground",
                  "motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
                )}
                aria-label="Notificações recentes, 3 não lidas"
              >
                <Bell className="size-5" aria-hidden="true" />
                <span
                  className={cn(
                    "absolute right-1 top-1 flex size-4 items-center justify-center rounded-full",
                    "bg-primary text-[10px] font-semibold text-primary-foreground"
                  )}
                  aria-hidden="true"
                >
                  {recentNotifications.length}
                </span>
                <span className="sr-only">
                  {recentNotifications.length} notificações não lidas
                </span>
              </summary>
              <div
                className={cn(
                  "absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border",
                  "bg-popover p-3 text-popover-foreground shadow-lg"
                )}
              >
                <h2 className="px-2 pb-2 text-sm font-semibold">
                  Notificações recentes
                </h2>
                <ul className="space-y-1">
                  {recentNotifications.map(({ title, detail }) => (
                    <li key={title} className="rounded-lg px-2 py-2.5">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </details>

            <details className="group relative">
              <summary
                className={cn(
                  "flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-secondary text-secondary-foreground",
                  "outline-none transition-colors hover:ring-2 hover:ring-ring",
                  "motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
                )}
                aria-label="Menu do usuário"
              >
                <UserRound className="size-5" aria-hidden="true" />
              </summary>
              <div
                className={cn(
                  "absolute right-0 z-40 mt-2 w-52 rounded-xl border",
                  "bg-popover p-1.5 text-popover-foreground shadow-lg"
                )}
              >
                <Link
                  href="/profile"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none",
                    "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <UserRound className="size-4" aria-hidden="true" />
                  Meu Perfil
                </Link>
                <Link
                  href="/settings"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none",
                    "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <Settings className="size-4" aria-hidden="true" />
                  Configurações
                </Link>
                <div className="my-1 border-t" />
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground outline-none",
                    "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  aria-label="Sair indisponível até a integração da sessão"
                  disabled
                  title="A integração de sessão ainda não está configurada"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sair
                </button>
              </div>
            </details>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 p-4 pt-2 outline-none md:px-8 md:pb-8 md:pt-3"
        >
          {children}
        </main>
      </div>
    </div>
  );
}