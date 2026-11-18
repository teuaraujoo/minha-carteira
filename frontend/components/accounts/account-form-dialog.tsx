"use client";

import { useEffect, useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import {
  ACCOUNT_BRAND_OPTIONS,
  ACCOUNT_TYPE_OPTIONS,
  DEFAULT_ACCOUNT_COLOR,
  INSTITUTION_SUGGESTIONS,
  type AccountType,
} from "@/components/accounts/account-catalog";
import { AccountWalletCard } from "@/components/accounts/account-wallet-card";
import { ApiClientError } from "@/services/api-client";
import { accountsService, type AccountDto } from "@/services/accounts.service";
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
import { cn } from "@/lib/utils";

function parseCurrencyInput(raw: string): number {
  const cleaned = raw.trim().replace(/\s+/g, "").replace("R$", "");
  if (!cleaned) return Number.NaN;

  // Aceita tanto formato brasileiro (1.250,50) quanto decimal com ponto (1250.50).
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;

  return Number(normalized);
}

const accountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(60, "O nome da conta deve ter no máximo 60 caracteres."),
  type: z.enum(["CHECKING", "DIGITAL", "SAVINGS", "CASH", "INVESTMENT"]),
  initialBalanceText: z
    .string()
    .trim()
    .min(1, "Informe o saldo inicial da conta.")
    .refine((value) => Number.isFinite(parseCurrencyInput(value)), {
      message: "Informe um valor numérico válido (ex.: 1500,00).",
    }),
  brand: z.string(),
  institution: z
    .string()
    .trim()
    .max(40, "O nome da instituição deve ter no máximo 40 caracteres."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Informe uma cor hexadecimal válida (ex.: #012048)."),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountToEdit?: AccountDto | null;
  onSaved?: (account: AccountDto) => void;
}

function buildDefaultValues(account?: AccountDto | null): AccountFormValues {
  if (!account) {
    return {
      name: "",
      type: "CHECKING",
      initialBalanceText: "0,00",
      brand: "",
      institution: "",
      color: DEFAULT_ACCOUNT_COLOR,
    };
  }

  return {
    name: account.name,
    type: account.type,
    initialBalanceText: account.initialBalance.toFixed(2).replace(".", ","),
    brand: account.brand ?? "",
    institution: account.institution ?? "",
    color: account.color ?? DEFAULT_ACCOUNT_COLOR,
  };
}

export function AccountFormDialog({
  open,
  onOpenChange,
  accountToEdit = null,
  onSaved,
}: AccountFormDialogProps) {
  const isEditing = Boolean(accountToEdit);
  const nameId = useId();
  const nameErrorId = useId();
  const balanceId = useId();
  const balanceErrorId = useId();
  const institutionId = useId();
  const institutionErrorId = useId();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    mode: "onTouched",
    defaultValues: buildDefaultValues(accountToEdit),
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaultValues(accountToEdit));
    }
  }, [accountToEdit, open, reset]);

  const watchedValues = useWatch({ control });

  const previewInitialBalance = parseCurrencyInput(
    watchedValues.initialBalanceText ?? "0",
  );
  const resolvedPreviewBalance = Number.isFinite(previewInitialBalance)
    ? previewInitialBalance
    : 0;

  const previewAccount = {
    id: accountToEdit?.id ?? "preview-account",
    name: watchedValues.name?.trim() || "Minha nova conta",
    type: (watchedValues.type as AccountType) || "CHECKING",
    brand: watchedValues.brand?.trim() || null,
    institution: watchedValues.institution?.trim() || null,
    color: watchedValues.color || DEFAULT_ACCOUNT_COLOR,
    initialBalance: accountToEdit?.initialBalance ?? resolvedPreviewBalance,
    currentBalance: accountToEdit?.currentBalance ?? resolvedPreviewBalance,
    status: accountToEdit?.status ?? ("ACTIVE" as const),
  };

  const onSubmit = async (values: AccountFormValues) => {
    try {
      if (accountToEdit) {
        const updated = await accountsService.updateAccount(accountToEdit.id, {
          name: values.name.trim(),
          type: values.type,
          brand: values.brand.trim() || null,
          institution: values.institution.trim() || null,
          color: values.color || DEFAULT_ACCOUNT_COLOR,
        });

        toast.success(`Conta "${updated.name}" atualizada.`);
        onSaved?.(updated);
        onOpenChange(false);
        return;
      }

      const parsedBalance = parseCurrencyInput(values.initialBalanceText);
      const created = await accountsService.createAccount({
        name: values.name.trim(),
        type: values.type,
        initialBalance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
        brand: values.brand.trim() || null,
        institution: values.institution.trim() || null,
        color: values.color || DEFAULT_ACCOUNT_COLOR,
      });

      toast.success(`Conta "${created.name}" adicionada.`);
      onSaved?.(created);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 409) {
          setError("name", { message: error.message });
          return;
        }
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível salvar a conta financeira.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize a identificação visual e a categoria desta conta. O saldo inicial é preservado para auditoria."
              : "Configure nome, tipo, saldo inicial e identidade visual para acompanhar esta conta na carteira."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(380px,430px)] lg:items-start">
            {/* Campos do formulário */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={nameId}>Nome da conta</Label>
                <Input
                  id={nameId}
                  placeholder="Ex.: Nubank Principal, Carteira ou Itaú"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? nameErrorId : undefined}
                  {...register("name")}
                />
                {errors.name ? (
                  <p id={nameErrorId} className="text-xs font-medium text-destructive">
                    {errors.name.message}
                  </p>
                ) : null}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">
                  Tipo de conta
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ACCOUNT_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const checked = watchedValues.type === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                          checked
                            ? "border-primary bg-primary/8 text-foreground ring-2 ring-ring/40"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          value={option.value}
                          {...register("type")}
                          className="sr-only"
                        />
                        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{option.shortLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={balanceId}>Saldo inicial (R$)</Label>
                  <Input
                    id={balanceId}
                    inputMode="decimal"
                    disabled={isEditing}
                    aria-invalid={Boolean(errors.initialBalanceText)}
                    aria-describedby={
                      errors.initialBalanceText ? balanceErrorId : undefined
                    }
                    {...register("initialBalanceText")}
                  />
                  {isEditing ? (
                    <p className="text-[11px] text-muted-foreground">
                      Somente leitura após criação. Alterado apenas via movimentações.
                    </p>
                  ) : errors.initialBalanceText ? (
                    <p
                      id={balanceErrorId}
                      className="text-xs font-medium text-destructive"
                    >
                      {errors.initialBalanceText.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={institutionId}>Instituição (opcional)</Label>
                  <Input
                    id={institutionId}
                    placeholder="Ex.: Nubank, Itaú, Inter"
                    aria-invalid={Boolean(errors.institution)}
                    aria-describedby={errors.institution ? institutionErrorId : undefined}
                    {...register("institution")}
                  />
                  {errors.institution ? (
                    <p
                      id={institutionErrorId}
                      className="text-xs font-medium text-destructive"
                    >
                      {errors.institution.message}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Sugestões rápidas de instituições */}
              <div className="flex flex-wrap gap-1.5">
                {INSTITUTION_SUGGESTIONS.slice(0, 6).map((inst) => {
                  const active =
                    watchedValues.institution?.trim().toLowerCase() ===
                    inst.toLowerCase();
                  return (
                    <button
                      key={inst}
                      type="button"
                      onClick={() =>
                        setValue("institution", active ? "" : inst, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                      }
                      className={cn(
                        "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {inst}
                    </button>
                  );
                })}
              </div>

              {/* Seletor de bandeira (opcional) */}
              <div className="space-y-2">
                <Label>Bandeira do cartão (opcional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setValue("brand", "", { shouldDirty: true, shouldTouch: true })
                    }
                    className={cn(
                      "cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                      !watchedValues.brand
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    Sem bandeira
                  </button>
                  {ACCOUNT_BRAND_OPTIONS.map((brandOption) => {
                    const active = watchedValues.brand === brandOption.key;
                    return (
                      <button
                        key={brandOption.key}
                        type="button"
                        onClick={() =>
                          setValue("brand", active ? "" : brandOption.key, {
                            shouldDirty: true,
                            shouldTouch: true,
                          })
                        }
                        className={cn(
                          "cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {brandOption.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paleta de cor do card */}
              <div className="space-y-2">
                <Label>Cor do cartão</Label>
                <ColorPalettePicker
                  value={watchedValues.color ?? DEFAULT_ACCOUNT_COLOR}
                  onChange={(hex) =>
                    setValue("color", hex, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                  label="Cor do cartão"
                />
                {errors.color ? (
                  <p className="text-xs text-destructive">
                    {errors.color.message}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Prévia ao vivo do card */}
            <div className="space-y-2.5 rounded-2xl border border-border/80 bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Prévia do cartão
                </p>
                <span className="text-[11px] text-muted-foreground">Tempo real</span>
              </div>
              <AccountWalletCard account={previewAccount} isFront />
              <p className="text-xs text-muted-foreground">
                Você pode alterar cor, nome, bandeira ou instituição a qualquer momento.
              </p>
            </div>
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
              {isEditing ? "Salvar alterações" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
