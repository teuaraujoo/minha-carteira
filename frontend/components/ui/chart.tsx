"use client";

import {
  createContext,
  useContext,
  useId,
  type ComponentProps,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: ReactNode;
    icon?: ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

function useChart() {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error("useChart deve ser utilizado dentro de um <ChartContainer />.");
  }
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ComponentProps<"div"> & {
  config: ChartConfig;
  children: ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => Boolean(itemConfig.theme || itemConfig.color),
  );

  if (colorConfig.length === 0) {
    return null;
  }

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");

  const cssRules = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const declarations = colorConfig
        .map(([key, itemConfig]) => {
          const color =
            itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ??
            itemConfig.color;
          const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "");
          return color ? `  --color-${safeKey}: ${color};` : null;
        })
        .filter(Boolean)
        .join("\n");

      return `${prefix} [data-chart="${safeId}"] {\n${declarations}\n}`;
    })
    .join("\n");

  return <style>{cssRules}</style>;
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipPayloadItem = NonNullable<
  RechartsPrimitive.TooltipContentProps<number | string, string>["payload"]
>[number];

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string,
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const nestedPayload =
    "payload" in record &&
    typeof record.payload === "object" &&
    record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : undefined;

  let configLabelKey: string = key;

  if (typeof record[key] === "string") {
    configLabelKey = record[key] as string;
  } else if (nestedPayload && typeof nestedPayload[key] === "string") {
    configLabelKey = nestedPayload[key] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: Partial<RechartsPrimitive.TooltipContentProps> &
  ComponentProps<"div"> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
  }) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  const firstItem = payload[0];
  const resolvedLabelKey = `${labelKey || firstItem?.dataKey || firstItem?.name || "value"}`;
  const firstConfig = getPayloadConfigFromPayload(config, firstItem, resolvedLabelKey);
  const rawLabel =
    !labelKey && typeof label === "string"
      ? (config[label]?.label ?? label)
      : firstConfig?.label ?? label;

  const formattedLabel = labelFormatter
    ? labelFormatter(rawLabel, payload)
    : rawLabel;

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-36 items-start gap-1.5 rounded-xl border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg",
        className,
      )}
    >
      {!hideLabel && !nestLabel && formattedLabel ? (
        <div className={cn("font-semibold text-foreground", labelClassName)}>
          {formattedLabel}
        </div>
      ) : null}
      <div className="grid gap-1.5">
        {payload.map((item: TooltipPayloadItem, index: number) => {
          const key = `${nameKey || item.name || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const nestedFill =
            item.payload &&
            typeof item.payload === "object" &&
            "fill" in item.payload &&
            typeof item.payload.fill === "string"
              ? item.payload.fill
              : undefined;
          const indicatorColor = color || nestedFill || item.color;

          return (
            <div
              key={`${item.dataKey ?? item.name ?? index}`}
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-3 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center",
              )}
            >
              {formatter && item.value !== undefined && item.name !== undefined ? (
                formatter(item.value, item.name, item, index, payload)
              ) : (
                <>
                  {!hideIndicator ? (
                    itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      <div
                        className={cn(
                          "shrink-0 rounded-[2px] border-[var(--color-border)] bg-[var(--color-bg)]",
                          indicator === "dot" && "size-2.5 rounded-full",
                          indicator === "line" && "w-1",
                          indicator === "dashed" &&
                            "my-0.5 w-0 border-[1.5px] border-dashed bg-transparent",
                        )}
                        style={
                          {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor,
                          } as CSSProperties
                        }
                      />
                    )
                  ) : null}
                  <div
                    className={cn(
                      "flex flex-1 justify-between gap-4 leading-none",
                      nestLabel ? "items-end" : "items-center",
                    )}
                  >
                    <div className="grid gap-1">
                      {nestLabel && !hideLabel && formattedLabel ? (
                        <span className="font-semibold text-foreground">
                          {formattedLabel}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label ?? item.name}
                      </span>
                    </div>
                    {item.value !== undefined ? (
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {typeof item.value === "number"
                          ? item.value.toLocaleString("pt-BR")
                          : String(item.value)}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: ComponentProps<"div"> &
  Pick<RechartsPrimitive.DefaultLegendContentProps, "payload" | "verticalAlign"> & {
    hideIcon?: boolean;
    nameKey?: string;
  }) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-4 text-xs",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div
            key={String(item.value ?? key)}
            className="flex items-center gap-1.5 text-muted-foreground [&>svg]:size-3"
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span>{itemConfig?.label ?? item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
};
