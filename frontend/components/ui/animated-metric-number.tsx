"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export type MetricNumberFormat = "currency" | "integer";

export interface AnimatedMetricNumberProps {
  /** Valor numérico alvo exibido pela métrica. */
  value: number;
  /** Formato de apresentação numérica (moeda BRL ou inteiro). */
  format?: MetricNumberFormat;
  /** Oculta o número com máscara sem animar dígitos. */
  hidden?: boolean;
  /** Prefixo opcional exibido junto ao valor formatado (ex.: parêntese de abertura). */
  prefix?: string;
  /** Sufixo opcional exibido junto ao valor formatado (ex.: parêntese de fechamento). */
  suffix?: string;
  /** Duração em segundos, sincronizada com o fade-in da página. */
  duration?: number;
  className?: string;
}

const DEFAULT_COUNT_DURATION_SECONDS = 0.45;
const EASE_OUT_CURVE = [0.22, 1, 0.36, 1] as const;

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const INTEGER_FORMATTER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

function formatMetricText(
  rawValue: number,
  format: MetricNumberFormat,
  hidden: boolean,
  prefix: string,
  suffix: string,
  roundIntermediate: boolean,
): string {
  if (hidden) {
    const masked = format === "currency" ? "R$ •••••" : "•••";
    return `${prefix}${masked}${suffix}`;
  }

  if (format === "integer") {
    const rounded = Math.round(rawValue);
    const normalized = Object.is(rounded, -0) || rounded === 0 ? 0 : rounded;
    return `${prefix}${INTEGER_FORMATTER.format(normalized)}${suffix}`;
  }

  const candidate = roundIntermediate
    ? Math.round(rawValue * 100) / 100
    : rawValue;
  // Evita exibir "-R$ 0,00" durante interpolações muito próximas de zero
  const normalized = Math.abs(candidate) < 0.005 ? 0 : candidate;
  return `${prefix}${BRL_FORMATTER.format(normalized)}${suffix}`;
}

/**
 * Exibe números de métricas com contagem suave de 0 até o valor alvo em sincronia
 * com o fade-in da página, mantendo largura reservada e leitura acessível estática.
 */
export function AnimatedMetricNumber({
  value,
  format = "currency",
  hidden = false,
  prefix = "",
  suffix = "",
  duration = DEFAULT_COUNT_DURATION_SECONDS,
  className,
}: AnimatedMetricNumberProps) {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = prefersReducedMotion === true;

  const displayRef = useRef<HTMLSpanElement | null>(null);
  const currentNumericRef = useRef<number>(0);

  const finalFormatted = formatMetricText(
    safeTarget,
    format,
    hidden,
    prefix,
    suffix,
    false,
  );
  // Congela o texto inicial no JSX para o React não sobrescrever o DOM em re-renders futuros
  const [initialText] = useState(() => finalFormatted);

  useEffect(() => {
    const element = displayRef.current;
    if (!element) {
      return;
    }

    const osReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (hidden) {
      currentNumericRef.current = 0;
      element.textContent = finalFormatted;
      return;
    }

    if (isReducedMotion || osReducedMotion) {
      currentNumericRef.current = safeTarget;
      element.textContent = finalFormatted;
      return;
    }

    const startValue = currentNumericRef.current;
    if (Math.abs(safeTarget - startValue) < 0.0001) {
      currentNumericRef.current = safeTarget;
      element.textContent = finalFormatted;
      return;
    }

    // Garante ponto inicial visível coerente no início da transição
    element.textContent = formatMetricText(
      startValue,
      format,
      false,
      prefix,
      suffix,
      true,
    );

    const controls = animate(startValue, safeTarget, {
      duration,
      ease: EASE_OUT_CURVE,
      onUpdate: (latest) => {
        currentNumericRef.current = latest;
        element.textContent = formatMetricText(
          latest,
          format,
          false,
          prefix,
          suffix,
          true,
        );
      },
      onComplete: () => {
        currentNumericRef.current = safeTarget;
        element.textContent = finalFormatted;
      },
    });

    return () => {
      controls.stop();
    };
  }, [
    safeTarget,
    format,
    hidden,
    prefix,
    suffix,
    duration,
    finalFormatted,
    isReducedMotion,
  ]);

  return (
    <span className={cn("relative inline-grid tabular-nums", className)}>
      {/* Reserva a largura exata do valor final para evitar deslocamento de elementos vizinhos */}
      <span aria-hidden="true" className="invisible select-none [grid-area:1/1]">
        {finalFormatted}
      </span>
      <span ref={displayRef} aria-hidden="true" className="[grid-area:1/1]">
        {initialText}
      </span>
      <span className="sr-only">{finalFormatted}</span>
    </span>
  );
}
