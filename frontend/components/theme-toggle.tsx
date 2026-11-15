"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "mc-theme";

type ThemeScheme = "light" | "dark";

function readStoredTheme(): ThemeScheme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function resolveCurrentTheme(): ThemeScheme {
  const stored = readStoredTheme();
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDocument(scheme: ThemeScheme, storedValue: ThemeScheme | null): void {
  const root = document.documentElement;
  root.classList.toggle("dark", scheme === "dark");
  root.classList.toggle("light", scheme === "light");

  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute("content", storedValue ?? "light dark");
  }
}

export function ThemeToggle() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const syncFromEnvironment = () => {
      const stored = readStoredTheme();
      const resolved: ThemeScheme = stored ?? (mediaQuery.matches ? "dark" : "light");
      applyThemeToDocument(resolved, stored);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === THEME_STORAGE_KEY) {
        syncFromEnvironment();
      }
    };

    syncFromEnvironment();
    mediaQuery.addEventListener("change", syncFromEnvironment);
    window.addEventListener("storage", handleStorage);

    return () => {
      mediaQuery.removeEventListener("change", syncFromEnvironment);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function handleToggle() {
    const current = resolveCurrentTheme();
    const next: ThemeScheme = current === "dark" ? "light" : "dark";

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // A alternância continua ativa na sessão atual mesmo sem armazenamento persistente.
    }

    applyThemeToDocument(next, next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleToggle}
      aria-label="Alternar tema claro e escuro"
      title="Alternar tema"
      className="text-muted-foreground hover:text-foreground"
    >
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <Moon className="block size-4 dark:hidden" aria-hidden="true" />
    </Button>
  );
}
