"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import toast from "react-hot-toast";

import { AccountMetricCard } from "@/components/accounts/account-metric-card";
import { AppShell } from "@/components/app-shell";
import type { CategoryStatus } from "@/components/categories/category-catalog";
import {
  deleteMockCategory,
  toggleMockCategoryStatus,
  useCategoriesStore,
  type CategoryItem,
} from "@/components/categories/categories-mock-store";
import { CategoriesTable } from "@/components/categories/categories-table";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StatusFilter = CategoryStatus | "ALL";

export default function CategoriesPage() {
  const { categories } = useCategoriesStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<CategoryItem | null>(
    null,
  );

  const activeCount = useMemo(
    () => categories.filter((item) => item.status === "ACTIVE").length,
    [categories],
  );
  const inactiveCount = useMemo(
    () => categories.filter((item) => item.status === "INACTIVE").length,
    [categories],
  );
  const customCount = useMemo(
    () => categories.filter((item) => !item.isDefault).length,
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return categories
      .filter((item) => {
        if (statusFilter !== "ALL" && item.status !== statusFilter) {
          return false;
        }
        if (
          normalizedSearch &&
          !item.name.toLowerCase().includes(normalizedSearch)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Exibe categorias personalizadas primeiro e ordena alfabeticamente em pt-BR.
        if (a.isDefault !== b.isDefault) {
          return a.isDefault ? 1 : -1;
        }
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [categories, statusFilter, searchTerm]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() || statusFilter !== "ACTIVE",
  );

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ACTIVE");
  };

  const openCreateDialog = () => {
    setCategoryToEdit(null);
    setDialogOpen(true);
  };

  const openEditDialog = (category: CategoryItem) => {
    setCategoryToEdit(category);
    setDialogOpen(true);
  };

  const handleToggleStatus = (category: CategoryItem) => {
    const result = toggleMockCategoryStatus(category.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.category.status === "ACTIVE"
        ? `Categoria "${result.category.name}" reativada.`
        : `Categoria "${result.category.name}" desativada.`,
    );
  };

  const handleDeleteCategory = (category: CategoryItem) => {
    const result = deleteMockCategory(category.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`Categoria "${result.deleted.name}" excluída.`);
  };

  return (
    <AppShell>
      <section
        aria-label="Categorias financeiras"
        className="mx-auto w-full max-w-[1440px] space-y-6"
      >
        {/* Cabeçalho consolidado com filtro de status, ação e métricas */}
        <Card size="sm">
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Organização financeira
                  </span>
                  <Badge variant="outline">
                    {activeCount} {activeCount === 1 ? "ativa" : "ativas"}
                  </Badge>
                  {inactiveCount > 0 ? (
                    <Badge variant="muted">
                      {inactiveCount}{" "}
                      {inactiveCount === 1 ? "inativa" : "inativas"}
                    </Badge>
                  ) : null}
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Categorias
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filtro de status similar ao módulo de contas */}
                <div
                  role="group"
                  aria-label="Filtrar categorias por status"
                  className="inline-flex items-center rounded-full border border-border bg-muted/60 p-1"
                >
                  {(
                    [
                      { key: "ACTIVE", label: "Ativas" },
                      { key: "INACTIVE", label: "Inativas" },
                      { key: "ALL", label: "Todas" },
                    ] as const
                  ).map((option) => {
                    const active = statusFilter === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setStatusFilter(option.key)}
                        aria-pressed={active}
                        className={cn(
                          "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          active
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <Button type="button" onClick={openCreateDialog}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nova categoria
                </Button>
              </div>
            </div>

            {/* Faixa padronizada de métricas */}
            <div className="@container">
              <div className="grid grid-cols-1 gap-3 @[360px]:grid-cols-2 @[760px]:grid-cols-4">
                <AccountMetricCard
                  label="Total cadastradas"
                  value={categories.length}
                  valueFormat="integer"
                />
                <AccountMetricCard
                  label="Ativas"
                  value={activeCount}
                  valueFormat="integer"
                  tone="positive"
                />
                <AccountMetricCard
                  label="Inativas"
                  value={inactiveCount}
                  valueFormat="integer"
                  tone={inactiveCount > 0 ? "warning" : "neutral"}
                />
                <AccountMetricCard
                  label="Personalizadas"
                  value={customCount}
                  valueFormat="integer"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barra de busca */}
        <Card size="sm">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar categoria pelo nome..."
                aria-label="Buscar categoria pelo nome"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs text-muted-foreground">
                Exibindo{" "}
                <strong className="font-semibold text-foreground">
                  {filteredCategories.length}
                </strong>{" "}
                de{" "}
                <strong className="font-semibold text-foreground">
                  {categories.length}
                </strong>{" "}
                categorias
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="h-9 gap-1.5"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de categorias */}
        <CategoriesTable
          categories={filteredCategories}
          hasActiveFilters={hasActiveFilters}
          onEditCategory={openEditDialog}
          onToggleCategoryStatus={handleToggleStatus}
          onDeleteCategory={handleDeleteCategory}
          onClearFilters={clearFilters}
        />

        {/* Modal de criação / edição de categoria */}
        <CategoryFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          categoryToEdit={categoryToEdit}
        />
      </section>
    </AppShell>
  );
}
