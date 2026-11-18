"use client";

import { createElement, useEffect, useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { DEFAULT_ACCOUNT_COLOR } from "@/components/accounts/account-catalog";
import {
  CATEGORY_ICON_OPTIONS,
  CATEGORY_STATUS_META,
  resolveCategoryIconByKey,
} from "@/components/categories/category-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorPalettePicker } from "@/components/ui/color-palette-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  categoriesService,
  type CategoryDto,
} from "@/services/categories.service";

const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(60, "O nome da categoria deve ter no máximo 60 caracteres."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Informe uma cor hexadecimal válida (ex.: #012048)."),
  icon: z.string().trim().min(1, "Selecione um ícone."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryToEdit?: CategoryDto | null;
  onSaved?: (category: CategoryDto) => void;
}

function buildDefaultValues(category?: CategoryDto | null): CategoryFormValues {
  if (!category) {
    return {
      name: "",
      color: DEFAULT_ACCOUNT_COLOR,
      icon: "tag",
      status: "ACTIVE",
    };
  }

  return {
    name: category.name,
    color: category.color || DEFAULT_ACCOUNT_COLOR,
    icon: category.icon || "tag",
    status: category.status,
  };
}

const STATUS_ITEMS = {
  ACTIVE: CATEGORY_STATUS_META.ACTIVE.label,
  INACTIVE: CATEGORY_STATUS_META.INACTIVE.label,
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  categoryToEdit = null,
  onSaved,
}: CategoryFormDialogProps) {
  const isEditing = Boolean(categoryToEdit);
  const nameId = useId();
  const nameErrorId = useId();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: buildDefaultValues(categoryToEdit),
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaultValues(categoryToEdit));
    }
  }, [open, categoryToEdit, reset]);

  const watchedName = useWatch({ control, name: "name" }) ?? "";
  const watchedColor =
    useWatch({ control, name: "color" }) ?? DEFAULT_ACCOUNT_COLOR;
  const watchedIcon = useWatch({ control, name: "icon" }) ?? "tag";
  const watchedStatus = useWatch({ control, name: "status" }) ?? "ACTIVE";

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      let saved: CategoryDto;
      if (isEditing && categoryToEdit) {
        saved = await categoriesService.updateCategory(categoryToEdit.id, {
          name: values.name.trim(),
          color: values.color,
          icon: values.icon,
        });
        if (values.status !== saved.status) {
          saved =
            values.status === "INACTIVE"
              ? await categoriesService.deactivateCategory(saved.id)
              : await categoriesService.reactivateCategory(saved.id);
        }
      } else {
        saved = await categoriesService.createCategory({
          name: values.name.trim(),
          color: values.color,
          icon: values.icon,
        });
      }

      toast.success(
        isEditing
          ? "Categoria atualizada com sucesso."
          : "Categoria criada com sucesso.",
      );
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 409) {
          setError("name", { message: error.message });
        }
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível salvar a categoria.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize nome, cor, ícone ou status da categoria personalizada."
              : "Crie uma categoria personalizada com cor e ícone para organizar seus lançamentos."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Prévia rápida da categoria */}
          <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-muted/35 p-3.5">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background shadow-xs"
                style={{
                  color: /^#[0-9A-Fa-f]{6}$/.test(watchedColor)
                    ? watchedColor
                    : DEFAULT_ACCOUNT_COLOR,
                }}
              >
                {createElement(resolveCategoryIconByKey(watchedIcon), {
                  className: "size-5",
                  "aria-hidden": true,
                })}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {watchedName.trim() || "Nome da categoria"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Prévia da exibição na listagem
                </p>
              </div>
            </div>
            <Badge variant={CATEGORY_STATUS_META[watchedStatus].badgeVariant}>
              {CATEGORY_STATUS_META[watchedStatus].label}
            </Badge>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor={nameId}>Nome da categoria</Label>
            <Input
              id={nameId}
              placeholder="Ex.: Academia, Viagens, Freelance..."
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? nameErrorId : undefined}
              {...register("name")}
            />
            {errors.name ? (
              <p id={nameErrorId} className="text-xs text-destructive">
                {errors.name.message}
              </p>
            ) : null}
          </div>

          {/* Cor (padrões + seletor personalizável) */}
          <div className="space-y-2">
            <Label>Cor da categoria</Label>
            <ColorPalettePicker
              value={watchedColor}
              onChange={(hex) =>
                setValue("color", hex, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
              label="Cor da categoria"
            />
            {errors.color ? (
              <p className="text-xs text-destructive">{errors.color.message}</p>
            ) : null}
          </div>

          {/* Seletor de ícone */}
          <div className="space-y-2">
            <Label>Ícone</Label>
            <div
              role="group"
              aria-label="Selecionar ícone da categoria"
              className="grid grid-cols-5 gap-2 sm:grid-cols-7"
            >
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const selected = watchedIcon === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      setValue("icon", option.key, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                    aria-label={option.label}
                    aria-pressed={selected}
                    title={option.label}
                    className={cn(
                      "flex h-10 cursor-pointer items-center justify-center rounded-xl border transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      selected
                        ? "border-primary bg-primary/12 text-primary shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {createElement(option.icon, {
                      className: "size-4",
                      "aria-hidden": true,
                    })}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={watchedStatus}
              items={STATUS_ITEMS}
              onValueChange={(value) => {
                if (value === "ACTIVE" || value === "INACTIVE") {
                  setValue("status", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }
              }}
            >
              <SelectTrigger aria-label="Selecionar status da categoria">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Ativa</SelectItem>
                <SelectItem value="INACTIVE">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEditing ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
