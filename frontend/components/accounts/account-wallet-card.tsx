"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { Plus, ShieldOff } from "lucide-react";

import {
  ACCOUNT_TYPE_MAP,
  buildCardSurfaceStyle,
  formatDisplayCurrency,
  resolveAccountBrand,
  type AccountStatus,
  type AccountType,
} from "@/components/accounts/account-catalog";
import { cn } from "@/lib/utils";

export interface WalletCardAccountData {
  id: string;
  name: string;
  type: AccountType;
  brand: string | null;
  institution: string | null;
  color: string | null;
  initialBalance: number;
  currentBalance: number;
  status: AccountStatus;
}

interface AccountWalletCardProps {
  account: WalletCardAccountData;
  hideValues?: boolean;
  isFront?: boolean;
  isSelected?: boolean;
  showAddNotch?: boolean;
  onSelect?: () => void;
  onAddAccount?: () => void;
  ariaLabel?: string;
  className?: string;
}

export function AccountWalletCard({
  account,
  hideValues = false,
  isFront = true,
  isSelected = false,
  showAddNotch = false,
  onSelect,
  onAddAccount,
  ariaLabel,
  className,
}: AccountWalletCardProps) {
  const typeMeta = ACCOUNT_TYPE_MAP[account.type];
  const TypeIcon = typeMeta.icon;
  const brandMeta = resolveAccountBrand(account.brand);
  const surface = buildCardSurfaceStyle(account.color);
  const isInactive = account.status === "INACTIVE";

  const textPrimary = "text-slate-900 dark:text-slate-50";
  const textMuted = "text-slate-700/80 dark:text-slate-300/85";
  const pillClass =
    "border-slate-900/12 bg-white/45 text-slate-900 dark:border-white/20 dark:bg-white/10 dark:text-white";

  const hasNotch = Boolean(showAddNotch && onAddAccount);

  // Recorte arredondado em S no canto inferior direito para encaixe do botão flutuante
  const notchMaskStyle: CSSProperties = hasNotch
    ? {
        maskImage: [
          "linear-gradient(#000, #000)",
          "linear-gradient(#000, #000)",
          "linear-gradient(#000, #000)",
          "radial-gradient(circle 22px at 22px 22px, #000 98%, transparent 100%)",
          "radial-gradient(circle 22px at 0 0, transparent 98%, #000 100%)",
          "radial-gradient(circle 22px at 0 0, transparent 98%, #000 100%)",
        ].join(", "),
        maskSize:
          "100% 100%, 126px 50px, 148px 28px, 22px 22px, 22px 22px, 22px 22px",
        maskPosition:
          "0 0, right 0 bottom 0, right 0 bottom 0, right 126px bottom 28px, right 0 bottom 50px, right 148px bottom 0",
        maskRepeat: "no-repeat",
        maskComposite: "subtract, add, add, add, add",
      }
    : {};

  const cardBody = (
    <div
      className={cn(
        "relative flex h-[218px] w-full flex-col justify-between overflow-hidden rounded-[24px] border border-slate-900/10 bg-white/95 p-4 transition-all select-none @[310px]:p-5 dark:border-white/15 dark:bg-slate-900/95",
        isInactive && "saturate-50 opacity-90",
        textPrimary,
      )}
      style={notchMaskStyle}
    >
      {/* Camada colorida suave (menor força / opacidade) sobre a base neutra do cartão */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: surface.backgroundImage }}
      />

      {/* Brilho sutil decorativo para dar profundidade ao cartão */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full bg-white/25 blur-2xl dark:bg-white/10"
      />

      {/* Topo: bandeira (ou ícone do tipo) à esquerda + tipo e status à direita */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {brandMeta?.image ? (
            <span className="inline-flex h-8 items-center bg-transparent">
              <Image
                src={brandMeta.image}
                alt={`Bandeira ${brandMeta.label}`}
                width={72}
                height={28}
                className="h-5.5 w-auto object-contain"
              />
            </span>
          ) : brandMeta ? (
            <span
              className={cn(
                "inline-flex h-8 items-center rounded-lg border bg-transparent px-2.5 text-[11px] font-extrabold tracking-wider",
                pillClass,
              )}
            >
              {brandMeta.shortCode}
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-lg border backdrop-blur-xs",
                pillClass,
              )}
              title={typeMeta.label}
            >
              <TypeIcon className="size-4" aria-hidden="true" />
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isInactive ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-amber-800 backdrop-blur-xs @[310px]:px-2.5 dark:text-amber-200">
              <ShieldOff className="size-3" aria-hidden="true" />
              Inativa
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap backdrop-blur-xs @[310px]:px-2.5",
              pillClass,
            )}
          >
            <TypeIcon className="size-3" aria-hidden="true" />
            {typeMeta.shortLabel}
          </span>
        </div>
      </div>

      {/* Centro: saldo atual + instituição financeira (ou saldo inicial) */}
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className={cn("whitespace-nowrap text-xs font-medium", textMuted)}>Saldo atual</p>
          <p className="mt-0.5 whitespace-nowrap text-[clamp(1.1875rem,6.7cqi,1.75rem)] font-bold tracking-tight tabular-nums">
            {formatDisplayCurrency(account.currentBalance, hideValues)}
          </p>
        </div>

        <div className="min-w-0 shrink text-right">
          {account.institution ? (
            <>
              <p className={cn("whitespace-nowrap text-[11px] font-medium", textMuted)}>Instituição</p>
              <p className="mt-0.5 max-w-24 truncate text-xs font-semibold @[310px]:max-w-32 @[310px]:text-sm">
                {account.institution}
              </p>
            </>
          ) : (
            <>
              <p className={cn("whitespace-nowrap text-[11px] font-medium", textMuted)}>Saldo inicial</p>
              <p className="mt-0.5 whitespace-nowrap text-xs font-semibold tabular-nums @[310px]:text-sm">
                {formatDisplayCurrency(account.initialBalance, hideValues)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Base: nome da conta à esquerda com respiro para o recorte inferior direito */}
      <div
        className={cn(
          "relative z-10 flex items-end justify-between gap-3",
          hasNotch && "pr-40",
        )}
      >
        <div className="min-w-0">
          <p className={cn("text-[11px] font-medium", textMuted)}>Conta</p>
          <p className="mt-0.5 truncate text-sm font-semibold sm:text-[15px]">
            {account.name || "Nova conta"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "@container relative w-full",
        isFront
          ? "drop-shadow-[0_12px_24px_rgba(15,23,42,0.12)] dark:drop-shadow-[0_12px_24px_rgba(0,0,0,0.4)]"
          : "drop-shadow-[0_6px_14px_rgba(15,23,42,0.08)] dark:drop-shadow-[0_6px_14px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          aria-label={ariaLabel ?? `Selecionar conta ${account.name}`}
          className={cn(
            "block w-full cursor-pointer rounded-[24px] text-left outline-none transition-transform",
            "focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          {cardBody}
        </button>
      ) : (
        cardBody
      )}

      {/* Botão flutuante posicionado dentro do recorte transparente no canto inferior direito */}
      {hasNotch ? (
        <div className="absolute right-0 bottom-0 z-20 flex h-[44px] w-[142px] items-end justify-end bg-transparent">
          <button
            type="button"
            onClick={onAddAccount}
            className={cn(
              "inline-flex h-[40px] w-[138px] cursor-pointer items-center justify-center gap-1.5 rounded-full bg-slate-950 px-3.5 text-xs font-semibold text-white shadow-sm transition-all dark:bg-primary dark:text-primary-foreground",
              "hover:bg-slate-800 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-primary/90",
              "active:translate-y-px",
            )}
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Nova conta
          </button>
        </div>
      ) : null}
    </div>
  );
}
