import type { StaticImageData } from "next/image";
import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Car,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Layers,
  PiggyBank,
  Receipt,
  Repeat,
  RotateCcw,
  Smartphone,
  Tag,
  TrendingUp,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import eloLogo from "@/design/brands/elo.png";
import hipercardLogo from "@/design/brands/hipercard.png";
import mastercardLogo from "@/design/brands/mastercard.png";
import visaLogo from "@/design/brands/visa.png";

export type AccountType =
  | "CHECKING"
  | "CASH"
  | "DIGITAL"
  | "SAVINGS"
  | "INVESTMENT";

export type AccountStatus = "ACTIVE" | "INACTIVE";

export type AccountBrandKey =
  | "visa"
  | "mastercard"
  | "elo"
  | "hipercard";

export interface AccountTypeMeta {
  value: AccountType;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

export const ACCOUNT_TYPE_OPTIONS: readonly AccountTypeMeta[] = [
  {
    value: "CHECKING",
    label: "Conta corrente",
    shortLabel: "Corrente",
    description: "Movimentações diárias, PIX, débito e boletos.",
    icon: Landmark,
  },
  {
    value: "DIGITAL",
    label: "Conta digital",
    shortLabel: "Digital",
    description: "Carteiras digitais, bancos online e contas sem tarifa.",
    icon: Smartphone,
  },
  {
    value: "SAVINGS",
    label: "Poupança",
    shortLabel: "Poupança",
    description: "Reservas de emergência e metas de curto prazo.",
    icon: PiggyBank,
  },
  {
    value: "CASH",
    label: "Dinheiro em espécie",
    shortLabel: "Espécie",
    description: "Saldo físico em carteira para gastos do dia a dia.",
    icon: Banknote,
  },
  {
    value: "INVESTMENT",
    label: "Investimentos",
    shortLabel: "Investimentos",
    description: "Corretoras, renda fixa, fundos e custódia.",
    icon: TrendingUp,
  },
] as const;

export const ACCOUNT_TYPE_MAP: Record<AccountType, AccountTypeMeta> = {
  CHECKING: ACCOUNT_TYPE_OPTIONS[0],
  DIGITAL: ACCOUNT_TYPE_OPTIONS[1],
  SAVINGS: ACCOUNT_TYPE_OPTIONS[2],
  CASH: ACCOUNT_TYPE_OPTIONS[3],
  INVESTMENT: ACCOUNT_TYPE_OPTIONS[4],
};

export interface AccountBrandMeta {
  key: AccountBrandKey;
  label: string;
  image?: StaticImageData;
  accentColor: string;
  shortCode: string;
}

export const ACCOUNT_BRAND_OPTIONS: readonly AccountBrandMeta[] = [
  {
    key: "visa",
    label: "Visa",
    image: visaLogo,
    accentColor: "#1A1F71",
    shortCode: "VISA",
  },
  {
    key: "mastercard",
    label: "Mastercard",
    image: mastercardLogo,
    accentColor: "#EB001B",
    shortCode: "MC",
  },
  {
    key: "elo",
    label: "Elo",
    image: eloLogo,
    accentColor: "#00A4E0",
    shortCode: "ELO",
  },
  {
    key: "hipercard",
    label: "Hipercard",
    image: hipercardLogo,
    accentColor: "#B3131B",
    shortCode: "HIPER",
  },
] as const;

export const INSTITUTION_SUGGESTIONS: readonly string[] = [
  "Nubank",
  "Itaú",
  "Inter",
  "Banco do Brasil",
  "Santander",
  "Bradesco",
  "Caixa",
  "C6 Bank",
  "Mercado Pago",
  "BTG Pactual",
  "XP Investimentos",
  "PicPay",
] as const;

export interface AccountColorSwatch {
  hex: string;
  name: string;
}

export const ACCOUNT_COLOR_PALETTE: readonly AccountColorSwatch[] = [
  { hex: "#012048", name: "Azul Profundo" },
  { hex: "#015363", name: "Petróleo" },
  { hex: "#0F766E", name: "Esmeralda" },
  { hex: "#5B21B6", name: "Roxo Digital" },
  { hex: "#C2410C", name: "Laranja Banco" },
  { hex: "#B45309", name: "Âmbar" },
  { hex: "#881337", name: "Bordô" },
  { hex: "#1E293B", name: "Grafite" },
] as const;

export const DEFAULT_ACCOUNT_COLOR = ACCOUNT_COLOR_PALETTE[0].hex;

export function resolveAccountBrand(brand?: string | null): AccountBrandMeta | null {
  if (!brand) return null;
  const normalized = brand.trim().toLowerCase();
  if (!normalized) return null;

  return (
    ACCOUNT_BRAND_OPTIONS.find(
      (item) =>
        item.key === normalized || item.label.toLowerCase() === normalized,
    ) ?? null
  );
}

function parseHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Calcula a luminância relativa (WCAG) para garantir contraste legível no card.
 */
export function isLightHexColor(hex?: string | null): boolean {
  if (!hex) return false;
  const rgb = parseHexToRgb(hex);
  if (!rgb) return false;

  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const luminance =
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b);

  return luminance > 0.52;
}

export function buildCardSurfaceStyle(color?: string | null) {
  const baseHex = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_ACCOUNT_COLOR;
  const rgb = parseHexToRgb(baseHex) ?? { r: 1, g: 32, b: 72 };
  const lightSurface = isLightHexColor(baseHex);

  const softStart = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;
  const softMiddle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`;
  const softEnd = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`;

  return {
    baseHex,
    lightSurface,
    backgroundImage: `radial-gradient(circle at 86% 18%, rgba(255,255,255,0.42) 0%, transparent 52%), linear-gradient(135deg, ${softStart} 0%, ${softMiddle} 54%, ${softEnd} 100%)`,
  };
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrencyBRL(value: number): string {
  return brlFormatter.format(value);
}

export function formatDisplayCurrency(value: number, hidden: boolean): string {
  return hidden ? "R$ •••••" : formatCurrencyBRL(value);
}

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  alimentacao: Utensils,
  moradia: Home,
  transporte: Car,
  saude: HeartPulse,
  lazer: Gamepad2,
  educacao: GraduationCap,
  assinaturas: Repeat,
  salario: Briefcase,
  servicos: Wrench,
  poupanca: PiggyBank,
  rendimentos: TrendingUp,
  investimentos: TrendingUp,
  tarifas: Receipt,
  transferencias: ArrowLeftRight,
  reembolsos: RotateCcw,
  outros: Layers,
};

function normalizeCategoryKey(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Resolve um ícone representativo para cada categoria financeira.
 */
export function resolveCategoryIcon(category: string): LucideIcon {
  const key = normalizeCategoryKey(category);
  return CATEGORY_ICON_MAP[key] ?? Tag;
}
