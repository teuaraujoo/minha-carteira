"use client";

import { useId } from "react";
import { Pipette } from "lucide-react";

import {
  ACCOUNT_COLOR_PALETTE,
  type AccountColorSwatch,
} from "@/components/accounts/account-catalog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPalettePickerProps {
  value: string;
  onChange: (hex: string) => void;
  swatches?: readonly AccountColorSwatch[];
  label?: string;
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function ColorPalettePicker({
  value,
  onChange,
  swatches = ACCOUNT_COLOR_PALETTE,
  label = "Selecionar cor",
}: ColorPalettePickerProps) {
  const customInputId = useId();
  const hexInputId = useId();
  const normalizedValue = HEX_COLOR_REGEX.test(value)
    ? value.toUpperCase()
    : swatches[0]?.hex ?? "#012048";

  const isPresetSelected = swatches.some(
    (swatch) => swatch.hex.toUpperCase() === normalizedValue,
  );

  return (
    <div className="space-y-2.5" role="group" aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((swatch) => {
          const selected = normalizedValue === swatch.hex.toUpperCase();
          return (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => onChange(swatch.hex)}
              aria-label={`Cor ${swatch.name}`}
              aria-pressed={selected}
              title={swatch.name}
              className={cn(
                "size-8 cursor-pointer rounded-full border-2 transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected
                  ? "scale-110 border-foreground ring-2 ring-accent ring-offset-2 ring-offset-card"
                  : "border-white/40 hover:scale-105",
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          );
        })}

        {/* Seletor livre de cor personalizada */}
        <label
          htmlFor={customInputId}
          title="Escolher cor personalizada"
          className={cn(
            "relative flex size-8 cursor-pointer items-center justify-center rounded-full border-2 transition-transform focus-within:ring-2 focus-within:ring-ring",
            !isPresetSelected
              ? "scale-110 border-foreground ring-2 ring-accent ring-offset-2 ring-offset-card"
              : "border-dashed border-border bg-muted/60 text-muted-foreground hover:scale-105 hover:text-foreground",
          )}
          style={!isPresetSelected ? { backgroundColor: normalizedValue } : undefined}
        >
          <Pipette
            className={cn(
              "size-3.5",
              !isPresetSelected ? "text-white drop-shadow-xs" : "",
            )}
            aria-hidden="true"
          />
          <input
            id={customInputId}
            type="color"
            value={normalizedValue}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            aria-label="Escolher cor personalizada na paleta"
            className="sr-only"
          />
        </label>
      </div>

      {/* Entrada direta de código hexadecimal */}
      <div className="flex items-center gap-2">
        <span
          className="size-5 shrink-0 rounded-md border border-border"
          style={{ backgroundColor: normalizedValue }}
          aria-hidden="true"
        />
        <Input
          id={hexInputId}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder="#012048"
          maxLength={7}
          aria-label="Código hexadecimal da cor"
          className="h-8 w-28 font-mono text-xs uppercase"
        />
        <span className="text-xs text-muted-foreground">
          Escolha um padrão ou personalize no seletor
        </span>
      </div>
    </div>
  );
}
