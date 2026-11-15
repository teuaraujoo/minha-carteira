"use client";

import { useSyncExternalStore } from "react";

const PENDING_AUTH_EMAIL_KEY = "minha-carteira:pending-auth-email";
const PENDING_AUTH_EMAIL_EVENT = "mc-pending-auth-email-change";

function subscribePendingAuthEmail(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PENDING_AUTH_EMAIL_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PENDING_AUTH_EMAIL_EVENT, onStoreChange);
  };
}

/** Lê o e-mail pendente do fluxo de entrada salvo na sessão do navegador. */
export function readPendingAuthEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(PENDING_AUTH_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Salva o e-mail informado na entrada para reutilização nas telas seguintes. */
export function savePendingAuthEmail(email: string): void {
  if (typeof window === "undefined") return;
  const normalized = email.trim().toLowerCase();
  try {
    if (normalized) {
      window.sessionStorage.setItem(PENDING_AUTH_EMAIL_KEY, normalized);
    } else {
      window.sessionStorage.removeItem(PENDING_AUTH_EMAIL_KEY);
    }
    window.dispatchEvent(new Event(PENDING_AUTH_EMAIL_EVENT));
  } catch {
    // Ignora indisponibilidade de sessionStorage em ambientes restritos.
  }
}

/** Hook reativo e seguro para SSR que lê o e-mail salvo entre as telas de autenticação. */
export function usePendingAuthEmail(): string {
  return useSyncExternalStore(
    subscribePendingAuthEmail,
    readPendingAuthEmail,
    () => "",
  );
}
