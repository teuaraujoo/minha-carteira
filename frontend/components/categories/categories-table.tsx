"use client";

import { createElement } from "react";
import { Pencil, Power, RotateCcw, Tags, Trash2 } from "lucide-react";

import {
  CATEGORY_STATUS_META,
  resolveCategoryIconByKey,
} from "@/components/categories/category-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { CategoryDto } from "@/services/categories.service";

interface CategoriesTableProps {
  categories: CategoryDto[];
  hasActiveFilters: boolean;
  onEditCategory: (category: CategoryDto) => void;
  onToggleCategoryStatus: (category: CategoryDto) => void;
  onDeleteCategory: (category: CategoryDto) => void;
  onClearFilters: () => void;
}

export function CategoriesTable({
  categories,
  hasActiveFilters,
  onEditCategory,
  onToggleCategoryStatus,
  onDeleteCategory,
  onClearFilters,
}: CategoriesTableProps) {
  if (categories.length === 0) {
    return (
      <Empty className="border-border/80 bg-muted/20 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Tags className="size-5" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nenhuma categoria encontrada</EmptyTitle>
          <EmptyDescription>
            {hasActiveFilters
              ? "Nenhuma categoria corresponde aos filtros aplicados."
              : "Crie uma nova categoria personalizada para começar."}
          </EmptyDescription>
        </EmptyHeader>
        {hasActiveFilters ? (
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearFilters}
            >
              Limpar filtros
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[700px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-4 py-3.5">
              Categoria
            </th>
            <th scope="col" className="px-4 py-3.5">
              Origem
            </th>
            <th scope="col" className="px-4 py-3.5">
              Cor
            </th>
            <th scope="col" className="px-4 py-3.5">
              Status
            </th>
            <th scope="col" className="w-[180px] px-4 py-3.5 text-right">
              Ações
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border/70">
          {categories.map((category) => {
            const statusMeta = CATEGORY_STATUS_META[category.status];
            const isActive = category.status === "ACTIVE";

            return (
              <tr
                key={category.id}
                className="group transition-colors hover:bg-muted/35"
              >
                {/* Ícone + Nome */}
                <td className="px-4 py-3.5 align-middle">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background shadow-2xs"
                      style={{ color: category.color ?? "#64748B" }}
                    >
                      {createElement(resolveCategoryIconByKey(category.icon), {
                        className: "size-4",
                        "aria-hidden": true,
                      })}
                    </span>
                    <span className="font-medium text-foreground">
                      {category.name}
                    </span>
                  </div>
                </td>

                {/* Origem */}
                <td className="px-4 py-3.5 align-middle">
                  <Badge variant={category.isDefault ? "secondary" : "outline"}>
                    {category.isDefault ? "Padrão do sistema" : "Personalizada"}
                  </Badge>
                </td>

                {/* Cor */}
                <td className="px-4 py-3.5 align-middle">
                  <div className="inline-flex items-center gap-2">
                    <span
                      className="size-4 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: category.color ?? "#64748B" }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs text-muted-foreground uppercase">
                      {category.color ?? "#64748B"}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3.5 align-middle">
                  <Badge variant={statusMeta.badgeVariant}>
                    {statusMeta.label}
                  </Badge>
                </td>

                {/* Ações */}
                <td className="px-4 py-3.5 text-right align-middle">
                  {category.isDefault ? (
                    <span className="text-xs text-muted-foreground">
                      Somente leitura
                    </span>
                  ) : (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => onEditCategory(category)}
                        aria-label={`Editar categoria ${category.name}`}
                        title="Editar categoria"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>

                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => onToggleCategoryStatus(category)}
                        aria-label={
                          isActive
                            ? `Desativar categoria ${category.name}`
                            : `Reativar categoria ${category.name}`
                        }
                        title={isActive ? "Desativar" : "Reativar"}
                      >
                        {isActive ? (
                          <>
                            <Power className="size-3.5" aria-hidden="true" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <RotateCcw className="size-3.5" aria-hidden="true" />
                            Reativar
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="icon-xs"
                        variant="destructive"
                        onClick={() => onDeleteCategory(category)}
                        aria-label={`Excluir categoria ${category.name}`}
                        title="Excluir categoria"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
