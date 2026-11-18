"use client";

import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  AUTH_FIELD_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthLabel,
  AuthSmokeShell,
  createRiseMotion,
  type AuthTheme,
} from "@/components/ui/auth-smoke-shell";
import {
  savePendingAuthEmail,
  savePendingMfaChallenge,
} from "@/lib/auth-onboarding-storage";
import { ApiClientError } from "@/services/api-client";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";

const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail de acesso.")
    .email("Informe um e-mail válido."),
});

export type SmokeLoginFormValues = z.infer<typeof loginFormSchema>;

export type SmokeLoginProps = {
  brand?: string;
  headline?: string;
  headlineSubtext?: string;
  title?: string;
  subtitle?: string;
  /** Chamado com o e-mail validado do formulário. */
  onSubmit?: (values: SmokeLoginFormValues) => void | Promise<void>;
  onGoogleSignIn?: () => void | Promise<void>;
  mfaHref?: string;
  termsHref?: string;
  defaultTheme?: AuthTheme;
  className?: string;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function SmokeLogin({
  brand = "Minha Carteira",
  headline = "Clareza para cada decisão financeira.",
  headlineSubtext = "Organize contas, categorias e metas em um só lugar.",
  title = "Bem-vindo de volta",
  subtitle = "Acesse sua conta para acompanhar suas finanças.",
  onSubmit,
  onGoogleSignIn = () => wait(800),
  mfaHref = "/login/mfa",
  termsHref = "#",
  defaultTheme = "light",
  className,
}: SmokeLoginProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "form" | "google">(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const emailId = useId();
  const emailErrorId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SmokeLoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const submitForm = handleSubmit(async (values) => {
    if (busy) return;
    setBusy("form");
    setErrorMessage(null);
    try {
      savePendingAuthEmail(values.email);

      if (onSubmit) {
        await onSubmit(values);
        return;
      }

      const result = await authService.requestMfa({ email: values.email });
      savePendingMfaChallenge({
        challengeId: result.challengeId,
        nextAttemptAt: result.nextAttemptAt,
      });
      router.push(`${mfaHref}?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Não foi possível enviar o código de verificação.",
      );
    } finally {
      setBusy(null);
    }
  });

  const handleGoogle = async () => {
    if (busy) return;
    setBusy("google");
    try {
      await onGoogleSignIn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthSmokeShell
      brand={brand}
      headline={headline}
      headlineSubtext={headlineSubtext}
      defaultTheme={defaultTheme}
      className={className}
    >
      <motion.h1
        {...createRiseMotion(reduce, 2)}
        className="text-[34px] font-semibold leading-none tracking-[-0.045em]"
      >
        {title}
      </motion.h1>
      <motion.p
        {...createRiseMotion(reduce, 3)}
        className="mt-3 text-[15px] text-[var(--muted)]"
      >
        {subtitle}
      </motion.p>

      <motion.div {...createRiseMotion(reduce, 4)} className="mt-9">
        <ProviderButton
          onClick={handleGoogle}
          busy={busy === "google"}
          disabled={!!busy}
        >
          <GoogleIcon className="size-[18px]" />
          Entrar com Google
        </ProviderButton>
      </motion.div>

      <motion.div
        {...createRiseMotion(reduce, 5)}
        className="my-7 flex items-center gap-3 text-[12px] text-[var(--muted)]"
      >
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span>Ou entre com e-mail</span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </motion.div>

      <form onSubmit={submitForm} noValidate className="space-y-4">
        <motion.div {...createRiseMotion(reduce, 6)}>
          <AuthLabel htmlFor={emailId}>E-mail de acesso</AuthLabel>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? emailErrorId : undefined}
            className={cn(
              AUTH_FIELD_CLASS,
              errors.email &&
                "border-[var(--error)] focus:border-[var(--error)]",
            )}
            {...register("email")}
          />
          {errors.email && (
            <p
              id={emailErrorId}
              role="alert"
              className="mt-1.5 text-[12px] font-medium text-[var(--error)]"
            >
              {errors.email.message}
            </p>
          )}
          {errorMessage && (
            <p
              role="alert"
              className="mt-1.5 text-[12px] font-medium text-[var(--error)]"
            >
              {errorMessage}
            </p>
          )}
        </motion.div>

        <motion.div {...createRiseMotion(reduce, 7)} className="pt-2">
          <button
            type="submit"
            disabled={!!busy}
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            {busy === "form" ? (
              <LoaderCircle className="size-[18px] animate-spin" />
            ) : (
              "Enviar código"
            )}
          </button>
        </motion.div>
      </form>

      <motion.p
        {...createRiseMotion(reduce, 8)}
        className="mt-4 text-center text-[12px] text-[var(--muted)]"
      >
        Ao criar uma conta, você concorda com nossos{" "}
        <Link
          href={termsHref}
          className="text-[var(--ink)] underline underline-offset-2 transition-colors hover:text-[var(--accent)]"
        >
          termos e condições
        </Link>
        .
      </motion.p>
    </AuthSmokeShell>
  );
}

function ProviderButton({
  children,
  busy,
  ...props
}: {
  children: ReactNode;
  busy: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--field)] text-[14px] font-medium text-[var(--ink)] shadow-[0_1px_2px_rgb(1_32_72/0.05)] transition-[transform,border-color,background-color] duration-300 hover:border-[var(--muted)]/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {busy ? <LoaderCircle className="size-[17px] animate-spin" /> : children}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Ícone do Google
 * ------------------------------------------------------------------------- */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
