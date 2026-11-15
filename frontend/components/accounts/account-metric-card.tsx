"use client";

import { cn } from "@/lib/utils";

export type AccountMetricTone = "neutral" | "positive" | "negative" | "warning";

interface AccountMetricCardProps {
  label: string;
  value: string;
  secondaryValue?: string;
  tone?: AccountMetricTone;
  surface?: "subtle" | "card";
  className?: string;
}

const TONE_VALUE_CLASSES: Record<AccountMetricTone, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
};

/**
 * Cartão padronizado de métrica financeira para garantir alinhamento em linha única,
 * escala tipográfica consistente e ausência de cortes/overflow nos painéis de conta.
 */
export function AccountMetricCard({
  label,
  value,
  secondaryValue,
  tone = "neutral",
  surface = "subtle",
  className,
}: AccountMetricCardProps) {
  return (
    <div
      className={cn(
        "@container flex min-w-0 flex-col justify-between gap-1.5 px-3.5 py-3",
        surface === "card"
          ? "rounded-2xl border border-border bg-card shadow-xs"
          : "rounded-xl border border-border/80 bg-muted/40",
        className,
      )}
    >
      <p className="whitespace-nowrap text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "whitespace-nowrap text-[15px] font-bold tracking-tight tabular-nums @[170px]:text-base @[210px]:text-lg",
          TONE_VALUE_CLASSES[tone],
        )}
      >
        {value}
        {secondaryValue ? (
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">
            {secondaryValue}
          </span>
        ) : null}
      </p>
    </div>
  );
}
