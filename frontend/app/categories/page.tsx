"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import toast from "react-hot-toast";

import { AccountMetricCard } from "@/components/accounts/account-metric-card";
import { AppShell } from "@/components/app-shell";
import type { CategoryStatus } from "@/components/categories/category-catalog";
import { CategoriesTable } from "@/components/categories/categories-table";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  categoriesService,
  type CategoryDto,
  type ListCategoriesMetaDto,
} from "@/services/categories.service";

type StatusFilter = CategoryStatus | "ALL";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [meta, setMeta] = useState<ListCategoriesMetaDto>({
    page: 1,
    pageSize: 100,
    total: 0,
    totalPages: 1,
    activeCount: 0,
    inactiveCount: 0,
    customCount: 0,
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<CategoryDto | null>(
    null,
  );

  const reloadCategories = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;
    categoriesService
      .listCategories({
        pageSize: 100,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: searchTerm.trim() || undefined,
      })
      .then((response) => {
        if (!active) return;
        setCategories(response.items);
        if (response.meta) {
          setMeta(response.meta);
        }
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiClientError && error.status !== 401) {
          toast.error(error.message);
        }
      });

    return () => {
      active = false;
    };
  }, [statusFilter, searchTerm, refreshTick]);

  const activeCount = meta.activeCount;
  const inactiveCount = meta.inactiveCount;
  const customCount = meta.customCount;
  const totalCount = activeCount + inactiveCount;
  const filteredCategories = categories;

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

  const openEditDialog = (category: CategoryDto) => {
    setCategoryToEdit(category);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (category: CategoryDto) => {
    try {
      const updated =
        category.status === "ACTIVE"
          ? await categoriesService.deactivateCategory(category.id)
          : await categoriesService.reactivateCategory(category.id);

      toast.success(
        updated.status === "ACTIVE"
          ? `Categoria "${updated.name}" reativada.`
          : `Categoria "${updated.name}" desativada.`,
      );
      reloadCategories();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Não foi possível alterar o status da categoria.",
      );
    }
  };

  const handleDeleteCategory = async (category: CategoryDto) => {
    try {
      await categoriesService.deleteCategory(category.id);
      toast.success(`Categoria "${category.name}" excluída.`);
      reloadCategories();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Não foi possível excluir a categoria.",
      );
    }
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
                  value={totalCount}
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
                  {meta.total}
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
          onSaved={reloadCategories}
        />
      </section>
    </AppShell>
  );
}
