import {
  ArrowLeftRight,
  Briefcase,
  Car,
  Coffee,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Home,
  Layers,
  PiggyBank,
  Receipt,
  Repeat,
  RotateCcw,
  ShoppingBag,
  Tag,
  TrendingUp,
  Utensils,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type CategoryStatus = "ACTIVE" | "INACTIVE";

export interface CategoryIconMeta {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const CATEGORY_ICON_OPTIONS: readonly CategoryIconMeta[] = [
  { key: "tag", label: "Etiqueta", icon: Tag },
  { key: "utensils", label: "Alimentação", icon: Utensils },
  { key: "home", label: "Moradia", icon: Home },
  { key: "car", label: "Transporte", icon: Car },
  { key: "heart-pulse", label: "Saúde", icon: HeartPulse },
  { key: "gamepad-2", label: "Lazer", icon: Gamepad2 },
  { key: "repeat", label: "Assinaturas", icon: Repeat },
  { key: "graduation-cap", label: "Educação", icon: GraduationCap },
  { key: "briefcase", label: "Salário / Trabalho", icon: Briefcase },
  { key: "wrench", label: "Serviços", icon: Wrench },
  { key: "piggy-bank", label: "Poupança", icon: PiggyBank },
  { key: "trending-up", label: "Investimentos", icon: TrendingUp },
  { key: "receipt", label: "Tarifas / Contas", icon: Receipt },
  { key: "arrow-left-right", label: "Transferências", icon: ArrowLeftRight },
  { key: "rotate-ccw", label: "Reembolsos", icon: RotateCcw },
  { key: "shopping-bag", label: "Compras", icon: ShoppingBag },
  { key: "coffee", label: "Café / Lanches", icon: Coffee },
  { key: "zap", label: "Energia / Utilidades", icon: Zap },
  { key: "layers", label: "Outros", icon: Layers },
] as const;

const ICON_BY_KEY = new Map<string, LucideIcon>(
  CATEGORY_ICON_OPTIONS.map((item) => [item.key, item.icon]),
);

export const CATEGORY_STATUS_META: Record<
  CategoryStatus,
  { label: string; badgeVariant: "success" | "muted" }
> = {
  ACTIVE: {
    label: "Ativa",
    badgeVariant: "success",
  },
  INACTIVE: {
    label: "Inativa",
    badgeVariant: "muted",
  },
};

/**
 * Resolve o componente de ícone Lucide a partir da chave salva na categoria.
 */
export function resolveCategoryIconByKey(iconKey?: string | null): LucideIcon {
  if (!iconKey) return Tag;
  return ICON_BY_KEY.get(iconKey.trim().toLowerCase()) ?? Tag;
}
