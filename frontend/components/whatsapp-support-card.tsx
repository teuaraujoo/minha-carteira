"use client";

import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DEFAULT_WHATSAPP_URL = "https://web.whatsapp.com/";

function resolveSafeWhatsappUrl(rawUrl: string | undefined): string {
  if (!rawUrl || !rawUrl.trim()) return DEFAULT_WHATSAPP_URL;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "https:" ? parsed.toString() : DEFAULT_WHATSAPP_URL;
  } catch {
    return DEFAULT_WHATSAPP_URL;
  }
}

const WHATSAPP_URL = resolveSafeWhatsappUrl(process.env.NEXT_PUBLIC_WHATSAPP_URL);

function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      <path d="M9.5 9.2c.2-.5.4-.5.6-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4 0 .6l-.4.5c-.1.2-.2.3-.1.5.3.6.9 1.4 1.7 2 .6.4 1.1.7 1.6.9.2.1.4 0 .5-.1l.6-.7c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5v.5c0 .6-.5 1.1-1.2 1.2-.8.1-2.2-.1-4-1.1-2-1.1-3.4-2.8-4.1-4.1-.7-1.3-.8-2.3-.5-3.3Z" />
    </svg>
  );
}

export function WhatsappSupportCard({ collapsed }: { collapsed: boolean }) {
  const compactButtonClasses = cn(
    "mx-auto hidden size-10 items-center justify-center rounded-lg outline-none transition-colors motion-reduce:transition-none md:flex",
    "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30",
  );

  if (collapsed) {
    return (
      <div className="mt-auto border-t border-sidebar-border p-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Suporte WhatsApp"
                className={compactButtonClasses}
              >
                <WhatsappIcon className="size-4 shrink-0" />
              </a>
            }
          />
          <TooltipContent side="right">Suporte WhatsApp</TooltipContent>
        </Tooltip>

        <div className="md:hidden">
          <ExpandedSupportCard />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-auto border-t border-sidebar-border p-2.5">
      <ExpandedSupportCard />
    </div>
  );
}

function ExpandedSupportCard() {
  return (
    <div className="rounded-xl border border-sidebar-border bg-muted/70 p-3 text-sidebar-foreground">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          <WhatsappIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight">Suporte WhatsApp</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Dúvidas ou ajuda com sua conta? Fale com a nossa equipe.
          </p>
        </div>
      </div>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ size: "sm" }),
          "mt-3 w-full rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500",
        )}
      >
        <span>Falar no WhatsApp</span>
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}
