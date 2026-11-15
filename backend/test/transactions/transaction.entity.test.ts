import assert from "node:assert/strict";
import test from "node:test";
import {
  Transaction,
  validateTransactionDate,
} from "../../src/modules/transactions/domain/entities/transaction.entity.js";
import {
  TransactionStatus,
  TransactionType,
} from "../../src/modules/transactions/domain/enums/transaction.enums.js";

const now = new Date("2026-11-15T12:00:00.000Z");
const userId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const categoryId = "33333333-3333-4333-8333-333333333333";

test("Transaction.create normaliza campos opcionais e define confirmedAt apenas quando CONFIRMED", () => {
  const confirmedIncome = Transaction.create({
    userId,
    accountId,
    categoryId: "   ",
    description: "  Freela de sistema  ",
    amount: 1250.5,
    type: TransactionType.INCOME,
    transactionDate: "2026-11-15",
    notes: "   ",
    now,
  });

  assert.equal(confirmedIncome.description, "Freela de sistema");
  assert.equal(confirmedIncome.categoryId, null);
  assert.equal(confirmedIncome.notes, null);
  assert.equal(confirmedIncome.status, TransactionStatus.CONFIRMED);
  assert.equal(confirmedIncome.confirmedAt?.toISOString(), now.toISOString());
  assert.equal(confirmedIncome.getSignedBalanceDelta(), 1250.5);

  const pendingExpense = Transaction.create({
    userId,
    accountId,
    categoryId,
    description: "Aluguel mensal",
    amount: 2100,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    transactionDate: "2026-11-20",
    notes: "  Vencimento dia 20  ",
    now,
  });

  assert.equal(pendingExpense.categoryId, categoryId);
  assert.equal(pendingExpense.notes, "Vencimento dia 20");
  assert.equal(pendingExpense.status, TransactionStatus.PENDING);
  assert.equal(pendingExpense.confirmedAt, null);
  assert.equal(pendingExpense.getSignedBalanceDelta(), -2100);
});

test("Transaction rejeita valor <= 0, excesso de decimais e datas inválidas no calendário", () => {
  for (const invalidAmount of [0, -10, Number.NaN, Number.POSITIVE_INFINITY, 15.123, 1_000_000_000_000]) {
    assert.throws(() =>
      Transaction.create({
        userId,
        accountId,
        description: "Compra",
        amount: invalidAmount,
        type: TransactionType.EXPENSE,
        transactionDate: "2026-11-15",
        now,
      }),
    );
  }

  for (const invalidDate of ["15/11/2026", "2026-02-29", "2026-04-31", "2026-13-01"]) {
    assert.throws(() => validateTransactionDate(invalidDate));
  }

  assert.throws(() =>
    Transaction.create({
      userId,
      accountId,
      description: "A",
      amount: 10,
      type: TransactionType.EXPENSE,
      transactionDate: "2026-11-15",
      now,
    }),
  );

  assert.throws(() =>
    Transaction.create({
      userId,
      accountId,
      description: "Descrição válida",
      amount: 10,
      type: TransactionType.EXPENSE,
      transactionDate: "2026-11-15",
      notes: "x".repeat(501),
      now,
    }),
  );
});

test("Transaction.confirm funciona apenas para PENDING (INCOME e EXPENSE) e softDelete impede re-confirmar", () => {
  for (const type of [TransactionType.INCOME, TransactionType.EXPENSE]) {
    const pending = Transaction.create({
      userId,
      accountId,
      description: `Pendente ${type}`,
      amount: 300,
      type,
      status: TransactionStatus.PENDING,
      transactionDate: "2026-11-18",
      now,
    });

    const t1 = new Date("2026-11-15T13:00:00.000Z");
    pending.confirm(t1);
    assert.equal(pending.status, TransactionStatus.CONFIRMED);
    assert.equal(pending.confirmedAt?.toISOString(), t1.toISOString());
    assert.throws(() => pending.confirm(t1), /pendentes/i);

    const t2 = new Date("2026-11-15T14:00:00.000Z");
    pending.softDelete(t2);
    assert.equal(pending.deletedAt?.toISOString(), t2.toISOString());
    assert.throws(() => pending.softDelete(t2), /já foi excluída/i);
  }

  const deletedPending = Transaction.create({
    userId,
    accountId,
    description: "Cancelada antes de confirmar",
    amount: 50,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    transactionDate: "2026-11-18",
    now,
  });
  deletedPending.softDelete(new Date("2026-11-15T12:10:00.000Z"));
  assert.throws(() => deletedPending.confirm(new Date("2026-11-15T12:20:00.000Z")), /excluída/i);
});
