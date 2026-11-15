"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Bell,
  ChartPie,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  Settings,
  Tags,
  UserRound,
  Wallet,
  X,
  Goal,
  Group,
  Handshake 
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";
import { WhatsappSupportCard } from "@/components/whatsapp-support-card";
import { cn } from "@/lib/utils";

const navigationItems = [
  { label: "Visão Geral", href: "/", icon: LayoutDashboard },
  { label: "Transações", href: "/transactions", icon: ArrowLeftRight },
  { label: "Contas", href: "/accounts", icon: Wallet },
  { label: "Categorias", href: "/categories", icon: Tags },
  { label: "Recorrências", href: "/recurring-transactions", icon: Repeat },
  { label: "Orçamentos", href: "/budgets", icon: ChartPie },
  { label: "Metas", href: "/goals", icon: Goal },
  { label: "Grupos", href: "/groups", icon: Group },
  { label: "Amigos", href: "/friends", icon: Handshake },
  { label: "Configurações", href: "/settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/profile": "Perfil",
  "/accounts": "Contas",
  "/recurring-transactions": "Recorrências",
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

const SIDEBAR_COLLAPSED_KEY = "mc-sidebar-collapsed";
const sidebarListeners = new Set<() => void>();
let memorySidebarCollapsed: boolean | null = null;

function readSidebarCollapsed(): boolean {
  if (memorySidebarCollapsed !== null) return memorySidebarCollapsed;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function setSidebarCollapsed(nextCollapsed: boolean): void {
  memorySidebarCollapsed = nextCollapsed;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextCollapsed));
  } catch {
    // Mantém o estado em memória quando o armazenamento local estiver indisponível.
  }
  sidebarListeners.forEach((listener) => listener());
}

function subscribeSidebarCollapsed(listener: () => void): () => void {
  sidebarListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SIDEBAR_COLLAPSED_KEY) {
      memorySidebarCollapsed = event.newValue === "true";
      listener();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    sidebarListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    readSidebarCollapsed,
    () => false,
  );

  const activeItem = navigationItems.find(({ href }) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname?.startsWith(href + "/"),
  );
  const pageTitle = activeItem?.label ?? pageTitles[pathname ?? ""] ?? "Minha Carteira";

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-background md:flex">
        <a
          href="#main-content"
          className={cn(
            "sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50",
            "focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground",
          )}
        >
          Ir para o conteúdo
        </a>

        <aside
          id="app-navigation"
          className={cn(
            "border-b border-sidebar-border bg-sidebar text-sidebar-foreground",
            "md:sticky md:top-0 md:flex md:h-dvh md:shrink-0 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-b-0 md:border-r",
            "md:transition-[width] md:duration-200 md:ease-out motion-reduce:md:transition-none",
            mobileOpen ? "block" : "hidden",
            collapsed ? "md:w-16" : "md:w-60",
          )}
        >
          <div className="hidden h-16 shrink-0 items-center justify-center border-b border-sidebar-border px-3 md:flex">
            <Link
              href="/"
              aria-label="Minha Carteira — início"
              className="flex items-center justify-center overflow-hidden"
            >
              {collapsed ? (
                <Image
                  src="/icon.png"
                  alt=""
                  width={36}
                  height={36}
                  className="size-8 shrink-0 object-contain"
                  priority
                />
              ) : (
                <>
                  <Image
                    src="/logo.png"
                    alt="Minha Carteira"
                    width={2048}
                    height={768}
                    className="h-auto w-34 shrink-0 dark:hidden"
                    priority
                  />
                  <span className="hidden items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] text-sidebar-foreground dark:flex">
                    <Image
                      src="/icon.png"
                      alt=""
                      width={36}
                      height={36}
                      className="size-7 shrink-0 object-contain"
                      priority
                    />
                    <span>Minha Carteira</span>
                  </span>
                </>
              )}
            </Link>
          </div>

          <nav aria-label="Navegação principal" className="flex flex-col gap-1 p-2">
            {navigationItems.map(({ label, href, icon: Icon }) => {
              const active = activeItem?.href === href;
              return (
                <Tooltip key={href} disabled={!collapsed}>
                  <TooltipTrigger
                    render={
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex min-h-9 items-center rounded-lg px-3.5 text-sm font-medium outline-none transition-colors",
                          "motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          collapsed ? "gap-2 md:gap-0" : "gap-2.5",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        <span
                          className={cn(
                            "overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200 motion-reduce:transition-none",
                            collapsed ? "md:max-w-0 md:opacity-0" : "md:max-w-44 md:opacity-100",
                          )}
                        >
                          {label}
                        </span>
                      </Link>
                    }
                  />
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          <WhatsappSupportCard collapsed={collapsed} />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-8">
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

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hidden shrink-0 text-muted-foreground hover:text-foreground md:inline-flex motion-reduce:transition-none"
                      aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
                      aria-expanded={!collapsed}
                      aria-controls="app-navigation"
                      onClick={() => setSidebarCollapsed(!collapsed)}
                    >
                      {collapsed ? (
                        <PanelLeftOpen className="size-4" aria-hidden="true" />
                      ) : (
                        <PanelLeftClose className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  }
                />
                <TooltipContent side="bottom">
                  {collapsed ? "Expandir menu" : "Recolher menu"}
                </TooltipContent>
              </Tooltip>

              <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
                {pageTitle}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <ThemeToggle />

              <details className="group relative">
                <summary
                  className={cn(
                    "flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-muted-foreground",
                    "outline-none transition-colors hover:bg-muted hover:text-foreground",
                    "motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
                  )}
                  aria-label="Notificações recentes, 3 não lidas"
                >
                  <Bell className="size-5" aria-hidden="true" />
                  <span
                    className={cn(
                      "absolute right-1 top-1 flex size-4 items-center justify-center rounded-full",
                      "bg-primary text-[10px] font-semibold text-primary-foreground",
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
                    "absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border",
                    "bg-popover p-3 text-popover-foreground shadow-lg",
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
                    "motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
                  )}
                  aria-label="Menu do usuário"
                >
                  <UserRound className="size-5" aria-hidden="true" />
                </summary>
                <div
                  className={cn(
                    "absolute right-0 z-40 mt-2 w-52 rounded-xl border border-border",
                    "bg-popover p-1.5 text-popover-foreground shadow-lg",
                  )}
                >
                  <Link
                    href="/profile"
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    )}
                  >
                    <UserRound className="size-4" aria-hidden="true" />
                    Meu Perfil
                  </Link>
                  <Link
                    href="/settings"
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    )}
                  >
                    <Settings className="size-4" aria-hidden="true" />
                    Configurações
                  </Link>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive outline-none transition-colors",
                      "hover:bg-destructive/15 focus-visible:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive/40",
                      "disabled:cursor-not-allowed disabled:opacity-75 motion-reduce:transition-none",
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
            className="min-w-0 p-4 pt-4 outline-none md:px-8 md:pb-8 md:pt-6"
          >
            {/* A chave por rota reinicia o fade-in apenas no conteúdo, sem piscar barra lateral ou cabeçalho */}
            <div key={pathname} className="page-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className:
            "!rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-lg !text-sm",
        }}
      />
    </TooltipProvider>
  );
}
