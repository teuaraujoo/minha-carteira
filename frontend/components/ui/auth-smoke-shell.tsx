"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

export type AuthTheme = "light" | "dark";

export const AUTH_THEMES: Record<AuthTheme, Record<string, string>> = {
  light: {
    "--bg": "#F8FAFC",
    "--paper": "#FFFFFF",
    "--sheet": "#E2E8F0",
    "--ink": "#0F172A",
    "--muted": "#64748B",
    "--line": "#E2E8F0",
    "--field": "#F8FAFC",
    "--accent": "#00C7C4",
    "--btn": "#012048",
    "--btn-ink": "#FFFFFF",
    "--error": "#DC2626",
    "--success": "#16A34A",
    "--grain-blend": "multiply",
  },
  dark: {
    "--bg": "#07111E",
    "--paper": "#0C192C",
    "--sheet": "#132642",
    "--ink": "#F8FAFC",
    "--muted": "#94A3B8",
    "--line": "#1E293B",
    "--field": "#0F2036",
    "--accent": "#00C7C4",
    "--btn": "#00C7C4",
    "--btn-ink": "#012048",
    "--error": "#F87171",
    "--success": "#4ADE80",
    "--grain-blend": "soft-light",
  },
};

export const AUTH_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const AUTH_FIELD_CLASS =
  "mt-2 h-12 w-full rounded-[14px] border border-[var(--line)] bg-[var(--field)] px-4 text-[15px] text-[var(--ink)] shadow-[0_1px_2px_rgb(1_32_72/0.04)_inset] outline-none transition-[border-color,box-shadow,background-color] duration-300 placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)]";

export const AUTH_PRIMARY_BUTTON_CLASS =
  "group relative flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[var(--btn)] text-[15px] font-medium text-[var(--btn-ink)] shadow-[0_1px_2px_rgb(1_32_72/0.12)] transition-[transform,background-color,box-shadow] duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)] hover:shadow-[0_2px_6px_rgb(1_32_72/0.18)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

/** Retorna as propriedades de entrada escalonada respeitando preferência de movimento reduzido. */
export function createRiseMotion(reduce: boolean | null, index: number) {
  return {
    initial: reduce
      ? { opacity: 0 }
      : { opacity: 0, y: 10, filter: "blur(10px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: {
      duration: 0.9,
      delay: 0.15 + index * 0.07,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
}

export function AuthLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[13px] font-medium text-[var(--ink)]"
    >
      {children}
    </label>
  );
}

type AuthSmokeShellProps = {
  brand?: string;
  headline: string;
  headlineSubtext: string;
  defaultTheme?: AuthTheme;
  className?: string;
  children: ReactNode;
};

export function AuthSmokeShell({
  brand = "Minha Carteira",
  headline,
  headlineSubtext,
  defaultTheme = "light",
  className,
  children,
}: AuthSmokeShellProps) {
  const [theme, setTheme] = useState<AuthTheme>(defaultTheme);
  const reduce = useReducedMotion();
  const dark = theme === "dark";

  return (
    <main
      style={AUTH_THEMES[theme] as CSSProperties}
      className={cn(
        "relative grid min-h-dvh w-full grid-cols-[minmax(0,1fr)] gap-3 overflow-x-clip bg-[var(--bg)] p-3 font-sans text-[var(--ink)] transition-colors duration-700 lg:grid-cols-[1.08fr_1fr]",
        className,
      )}
    >
      {/* Textura sutil de papel em toda a página. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-35"
        style={{
          backgroundImage: AUTH_GRAIN,
          mixBlendMode: "var(--grain-blend)" as CSSProperties["mixBlendMode"],
        }}
      />

      {/* ---- Esquerda: shader interativo sobre folhas empilhadas ---- */}
      <section className="relative z-[1] min-h-[38vh] lg:min-h-0">
        <div
          aria-hidden="true"
          className="absolute inset-0 rotate-[-1.4deg] rounded-[28px] bg-[var(--sheet)] shadow-[0_1px_2px_rgb(1_32_72/0.08)] transition-colors duration-700"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rotate-[0.9deg] rounded-[28px] bg-[var(--paper)] shadow-[0_1px_2px_rgb(1_32_72/0.06),0_8px_24px_-12px_rgb(1_32_72/0.16)] transition-colors duration-700"
        />
        <div className="relative h-full overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--paper)] shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_1px_2px_rgb(1_32_72/0.08),0_24px_48px_-24px_rgb(1_32_72/0.25)] transition-colors duration-700">
          <SmokeCanvas dark={dark} />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage: AUTH_GRAIN,
              mixBlendMode: "var(--grain-blend)" as CSSProperties["mixBlendMode"],
            }}
          />

          {/* Gradiente suave para garantir contraste dos textos da marca sobre o canvas. */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-700",
              dark
                ? "bg-gradient-to-t from-[#07111E]/85 via-[#07111E]/25 to-[#07111E]/40"
                : "bg-gradient-to-t from-[#FFFFFF]/90 via-[#FFFFFF]/25 to-[#FFFFFF]/55",
            )}
          />

          <motion.div
            {...createRiseMotion(reduce, 0)}
            className="relative z-10 flex items-center gap-2.5 p-6 text-[15px] font-semibold tracking-[-0.02em]"
          >
            <Image
              src="/favicon.png"
              alt={brand}
              width={28}
              height={28}
              className="size-7 rounded-lg object-contain"
              priority
            />
            <span>{brand}</span>
          </motion.div>

          <motion.div
            {...createRiseMotion(reduce, 1)}
            className="absolute inset-x-6 bottom-6 z-10 hidden max-w-[24rem] sm:block"
          >
            <p className="text-[28px] font-medium leading-[1.12] tracking-[-0.035em]">
              {headline}
            </p>
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              {headlineSubtext}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ---- Direita: conteúdo principal da etapa de autenticação ---- */}
      <section className="relative z-[1] flex items-center justify-center px-5 py-16 sm:px-10">
        <ThemeSwitch
          theme={theme}
          onToggle={() => setTheme(dark ? "light" : "dark")}
        />

        <div className="w-full max-w-[360px]">{children}</div>
      </section>
    </main>
  );
}

export function ThemeSwitch({
  theme,
  onToggle,
  className,
}: {
  theme: AuthTheme;
  onToggle: () => void;
  className?: string;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Alternar para tema claro" : "Alternar para tema escuro"}
      className={cn(
        "absolute right-3 top-3 flex h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] pl-2.5 pr-3.5 text-[13px] font-medium shadow-[0_1px_2px_rgb(1_32_72/0.05)] transition-[transform,background-color,border-color] duration-300 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:right-6 sm:top-6",
        className,
      )}
    >
      <span className="relative grid size-4 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={theme}
            initial={{ opacity: 0, rotate: -90, scale: 0.6, filter: "blur(4px)" }}
            animate={{ opacity: 1, rotate: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="absolute"
          >
            {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </span>
      {dark ? "Escuro" : "Claro"}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Shader de fumaça WebGL adaptado às cores da marca (#012048, #015363, #00C7C4)
 * ------------------------------------------------------------------------- */

const RENDER_SCALE = 0.4;

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uDark;

float hash(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.02 + vec2(1.7, 9.2); a *= .5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float ar = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * ar, uv.y) * 1.25;
  float t = uTime * .07;

  // O ponteiro cria um redemoinho suave na fumaça.
  vec2 d = p - vec2(uMouse.x * ar, uMouse.y) * 1.25;
  float k = exp(-dot(d, d) * 1.6);
  p += vec2(-d.y, d.x) * k * .55;

  vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, 1.3) - t * .8));
  vec2 r = vec2(fbm(p + 3. * q + vec2(1.7, 9.2) + t * 1.2), fbm(p + 3. * q + vec2(8.3, 2.8) - t));
  float f = fbm(p + 2.6 * r + vec2(t * .4, -t * .3));

  float smoke = smoothstep(.3, .85, f);
  smoke *= smoke;
  float wisp = smoothstep(.55, .75, f) * (1. - smoothstep(.75, .95, f));
  float vein = (1. - smoothstep(.0, .045, abs(f - .58))) * smoothstep(.42, .62, r.y);

  vec3 brandPrimary = vec3(.004, .125, .282);   // #012048
  vec3 brandSecondary = vec3(.004, .325, .388); // #015363
  vec3 brandAccent = vec3(0., .780, .769);      // #00C7C4

  // Modo claro: tinta azul-marinho sobre papel claro, com veio teal/ciano
  vec3 paper = vec3(.973, .980, .988);          // #F8FAFC
  vec3 lit = mix(paper, brandPrimary, smoke * .85);
  lit = mix(lit, brandSecondary, vein * .75);
  lit += brandAccent * vein * .32 + (1. - smoke) * wisp * .04;

  // Modo escuro: fumaça azul-profunda com brilho ciano da marca
  vec3 night = mix(vec3(.027, .067, .118), vec3(.016, .043, .086), uv.y);
  vec3 drk = night + vec3(.22, .42, .56) * smoke * .62 + vec3(.6, .85, .9) * wisp * .08;
  drk += brandAccent * vein * .85;

  vec3 col = mix(lit, drk, uDark);
  col += (hash(gl_FragCoord.xy + fract(t)) - .5) / 255.;
  gl_FragColor = vec4(col, 1.);
}`;

function SmokeCanvas({ dark }: { dark: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const darkRef = useRef(dark ? 1 : 0);
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
    });
    if (!canvas || !gl) return;

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uDark = gl.getUniformLocation(program, "uDark");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    const mouse = { x: 0.7, y: 0.4, tx: 0.7, ty: 0.4 };
    let shade = darkRef.current;
    let time = 40;
    let raf = 0;
    let last = 0;

    const draw = () => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uDark, shade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / 30 - 2) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      time = 40 + (now - start) / 1000;
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 2.2);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 2.2);
      shade += (darkRef.current - shade) * Math.min(1, dt * 3.5);
      draw();
    };
    const play = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) draw();
      else raf = requestAnimationFrame(loop);
    };
    redraw.current = () => {
      if (!reduce.matches) return;
      shade = darkRef.current;
      draw();
    };

    const onMove = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - b.left) / b.width;
      mouse.ty = 1 - (e.clientY - b.top) / b.height;
    };

    const ro = new ResizeObserver(() => {
      const scale = Math.min(window.devicePixelRatio || 1, 2) * RENDER_SCALE;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    });
    ro.observe(canvas);
    canvas.addEventListener("pointermove", onMove);
    reduce.addEventListener("change", play);
    play();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      reduce.removeEventListener("change", play);
    };
  }, []);

  useEffect(() => {
    darkRef.current = dark ? 1 : 0;
    redraw.current();
  }, [dark]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 size-full"
    />
  );
}
