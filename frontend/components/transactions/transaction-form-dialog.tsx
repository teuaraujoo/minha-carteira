"use client";

import { useEffect, useId, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { TRANSACTION_STATUS_META } from "@/components/transactions/transaction-catalog";
import { ApiClientError } from "@/services/api-client";
import type { AccountDto } from "@/services/accounts.service";
import type { CategoryDto } from "@/services/categories.service";
import {
  transactionsService,
  type TransactionDto,
  type TransactionKind,
} from "@/services/transactions.service";
import { Button } from "@/components/ui/button";
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

function parsePositiveCurrencyInput(raw: string): number {
  const cleaned = raw.trim().replace(/\s+/g, "").replace("R$", "");
  if (!cleaned) return Number.NaN;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;

  return Number(normalized);
}

const transactionFormSchema = z.object({
  kind: z.enum(["INCOME", "EXPENSE"]),
  description: z
    .string()
    .trim()
    .min(2, "Informe uma descrição com pelo menos 2 caracteres.")
    .max(80, "A descrição deve ter no máximo 80 caracteres."),
  amountText: z
    .string()
    .trim()
    .min(1, "Informe o valor da transação.")
    .refine(
      (value) => {
        const parsed = parsePositiveCurrencyInput(value);
        return Number.isFinite(parsed) && parsed > 0;
      },
      {
        message: "Informe um valor maior que zero (ex.: 250,00).",
      },
    ),
  occurredAt: z.string().trim().min(1, "Informe a data da transação."),
  accountId: z.string().trim().min(1, "Selecione uma conta."),
  categoryId: z.string().trim(),
  status: z.enum(["CONFIRMED", "PENDING"]),
  notes: z
    .string()
    .trim()
    .max(500, "A observação deve ter no máximo 500 caracteres."),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind: TransactionKind;
  accounts: AccountDto[];
  categories: CategoryDto[];
  onSaved?: (transaction: TransactionDto) => void;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultValues(
  kind: TransactionKind,
  accounts: AccountDto[],
  categories: CategoryDto[],
): TransactionFormValues {
  const activeAccounts = accounts.filter((item) => item.status === "ACTIVE");
  const defaultAccountId = activeAccounts[0]?.id ?? accounts[0]?.id ?? "";
  const activeCategories = categories.filter((item) => item.status === "ACTIVE");
  const defaultCategoryId = activeCategories[0]?.id ?? "NONE";

  return {
    kind,
    description: "",
    amountText: "",
    occurredAt: getTodayIsoDate(),
    accountId: defaultAccountId,
    categoryId: defaultCategoryId,
    status: "CONFIRMED",
    notes: "",
  };
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  defaultKind,
  accounts,
  categories,
  onSaved,
}: TransactionFormDialogProps) {
  const descriptionId = useId();
  const descriptionErrorId = useId();
  const amountId = useId();
  const amountErrorId = useId();
  const dateId = useId();
  const dateErrorId = useId();
  const notesId = useId();
  const notesErrorId = useId();

  const activeAccounts = useMemo(
    () => accounts.filter((item) => item.status === "ACTIVE"),
    [accounts],
  );
  const selectableAccounts = activeAccounts.length > 0 ? activeAccounts : accounts;

  const activeCategories = useMemo(
    () => categories.filter((item) => item.status === "ACTIVE"),
    [categories],
  );
  const selectableCategories =
    activeCategories.length > 0 ? activeCategories : categories;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: buildDefaultValues(
      defaultKind,
      selectableAccounts,
      selectableCategories,
    ),
  });

  useEffect(() => {
    if (open) {
      reset(
        buildDefaultValues(defaultKind, selectableAccounts, selectableCategories),
      );
    }
  }, [open, defaultKind, selectableAccounts, selectableCategories, reset]);

  const selectedKind = useWatch({ control, name: "kind" }) ?? defaultKind;
  const selectedAccountId = useWatch({ control, name: "accountId" }) ?? "";
  const selectedCategoryId = useWatch({ control, name: "categoryId" }) ?? "NONE";
  const selectedStatus = useWatch({ control, name: "status" }) ?? "CONFIRMED";

  const accountItemsRecord = useMemo(
    () =>
      Object.fromEntries(
        selectableAccounts.map((account) => [account.id, account.name]),
      ),
    [selectableAccounts],
  );

  const categoryItemsRecord = useMemo(
    () => ({
      NONE: "Sem categoria",
      ...Object.fromEntries(
        selectableCategories.map((category) => [category.id, category.name]),
      ),
    }),
    [selectableCategories],
  );

  const statusItemsRecord = useMemo(
    () => ({
      CONFIRMED: TRANSACTION_STATUS_META.CONFIRMED.label,
      PENDING: TRANSACTION_STATUS_META.PENDING.label,
    }),
    [],
  );

  const handleKindChange = (nextKind: TransactionKind) => {
    setValue("kind", nextKind, { shouldValidate: true });
  };

  const onSubmit = async (values: TransactionFormValues) => {
    const amount = parsePositiveCurrencyInput(values.amountText);
    try {
      const created = await transactionsService.createTransaction({
        accountId: values.accountId,
        categoryId:
          values.categoryId && values.categoryId !== "NONE"
            ? values.categoryId
            : null,
        description: values.description.trim(),
        amount,
        type: values.kind,
        status: values.status,
        transactionDate: values.occurredAt,
        notes: values.notes.trim() || null,
      });

      toast.success(
        values.kind === "INCOME"
          ? "Receita lançada com sucesso."
          : "Despesa lançada com sucesso.",
      );
      onSaved?.(created);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setError("description", { message: error.message });
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível registrar a transação.");
    }
  };

  const isIncome = selectedKind === "INCOME";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isIncome ? "Lançar receita" : "Lançar despesa"}
          </DialogTitle>
          <DialogDescription>
            {isIncome
              ? "Registre uma entrada financeira com status confirmado ou pendente."
              : "Registre uma saída financeira vinculada a uma conta e categoria."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Seletor de tipo de movimentação */}
          <div
            role="group"
            aria-label="Tipo de transação"
            className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/50 p-1"
          >
            <button
              type="button"
              onClick={() => handleKindChange("INCOME")}
              aria-pressed={isIncome}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isIncome
                  ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowUpRight className="size-4" aria-hidden="true" />
              Receita (Entrada)
            </button>

            <button
              type="button"
              onClick={() => handleKindChange("EXPENSE")}
              aria-pressed={!isIncome}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                !isIncome
                  ? "bg-rose-600 text-white shadow-xs dark:bg-rose-500"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowDownLeft className="size-4" aria-hidden="true" />
              Despesa (Saída)
            </button>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor={descriptionId}>Descrição</Label>
            <Input
              id={descriptionId}
              placeholder={
                isIncome
                  ? "Ex.: Salário mensal, Freela redesign..."
                  : "Ex.: Supermercado, Aluguel, Assinatura..."
              }
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? descriptionErrorId : undefined
              }
              {...register("description")}
            />
            {errors.description ? (
              <p id={descriptionErrorId} className="text-xs text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={amountId}>Valor (R$)</Label>
              <Input
                id={amountId}
                inputMode="decimal"
                placeholder="Ex.: 1.250,00"
                aria-invalid={Boolean(errors.amountText)}
                aria-describedby={errors.amountText ? amountErrorId : undefined}
                {...register("amountText")}
              />
              {errors.amountText ? (
                <p id={amountErrorId} className="text-xs text-destructive">
                  {errors.amountText.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={dateId}>Data</Label>
              <Input
                id={dateId}
                type="date"
                aria-invalid={Boolean(errors.occurredAt)}
                aria-describedby={errors.occurredAt ? dateErrorId : undefined}
                {...register("occurredAt")}
              />
              {errors.occurredAt ? (
                <p id={dateErrorId} className="text-xs text-destructive">
                  {errors.occurredAt.message}
                </p>
              ) : null}
            </div>
          </div>

          {/* Conta e Categoria */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Select
                value={selectedAccountId}
                items={accountItemsRecord}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setValue("accountId", value, { shouldValidate: true });
                  }
                }}
              >
                <SelectTrigger aria-label="Selecionar conta">
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {selectableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId ? (
                <p className="text-xs text-destructive">
                  {errors.accountId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={selectedCategoryId}
                items={categoryItemsRecord}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setValue("categoryId", value, { shouldValidate: true });
                  }
                }}
              >
                <SelectTrigger aria-label="Selecionar categoria">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sem categoria</SelectItem>
                  {selectableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId ? (
                <p className="text-xs text-destructive">
                  {errors.categoryId.message}
                </p>
              ) : null}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={selectedStatus}
              items={statusItemsRecord}
              onValueChange={(value) => {
                if (value === "CONFIRMED" || value === "PENDING") {
                  setValue("status", value, { shouldValidate: true });
                }
              }}
            >
              <SelectTrigger aria-label="Selecionar status">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONFIRMED">Confirmada</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observação (notes) */}
          <div className="space-y-1.5">
            <Label htmlFor={notesId}>Observação (notes)</Label>
            <textarea
              id={notesId}
              rows={3}
              placeholder="Detalhes opcionais sobre este lançamento..."
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? notesErrorId : undefined}
              className={cn(
                "flex w-full min-w-0 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground shadow-xs transition-[color,box-shadow,border-color] outline-none",
                "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
                "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/25",
              )}
              {...register("notes")}
            />
            {errors.notes ? (
              <p id={notesErrorId} className="text-xs text-destructive">
                {errors.notes.message}
              </p>
            ) : null}
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
              {isIncome ? "Salvar receita" : "Salvar despesa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
