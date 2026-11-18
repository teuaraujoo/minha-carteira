"use client";

import { useSyncExternalStore } from "react";

const HIDE_VALUES_STORAGE_KEY = "minha-carteira:hide-values";
const HIDE_VALUES_EVENT = "mc-hide-values-change";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata um valor numérico como moeda brasileira (BRL). */
export function formatCurrencyBRL(value: number): string {
  return brlFormatter.format(value);
}

/** Formata um valor monetário respeitando a preferência de ocultação de saldos. */
export function formatDisplayCurrency(value: number, hidden: boolean): string {
  return hidden ? "R$ •••••" : formatCurrencyBRL(value);
}

function readHideValuesPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HIDE_VALUES_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeHideValues(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(HIDE_VALUES_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(HIDE_VALUES_EVENT, onStoreChange);
  };
}

/** Alterna a preferência global de ocultação de valores financeiros no navegador. */
export function toggleHideValuesPreference(): void {
  if (typeof window === "undefined") return;
  const next = !readHideValuesPreference();
  try {
    window.localStorage.setItem(HIDE_VALUES_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event(HIDE_VALUES_EVENT));
  } catch {
    // Ignora indisponibilidade de localStorage em ambientes restritos.
  }
}

/** Hook reativo e seguro para SSR para ler a preferência de ocultar valores. */
export function useHideValuesPreference(): boolean {
  return useSyncExternalStore(
    subscribeHideValues,
    readHideValuesPreference,
    () => false,
  );
}
