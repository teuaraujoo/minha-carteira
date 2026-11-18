"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, CheckCircle2, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthLabel,
  AuthSmokeShell,
  createRiseMotion,
  type AuthTheme,
} from "@/components/ui/auth-smoke-shell";
import {
  clearPendingAuthSession,
  readPendingMfaChallenge,
  savePendingAuthEmail,
  savePendingMfaChallenge,
  usePendingAuthEmail,
} from "@/lib/auth-onboarding-storage";
import { ApiClientError } from "@/services/api-client";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";

const MFA_CODE_LENGTH = 6;
const DEFAULT_RESEND_COOLDOWN_SECONDS = 45;

const mfaFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Informe os 6 dígitos do código enviado por e-mail."),
});

export type SmokeMfaFormValues = z.infer<typeof mfaFormSchema>;

export type SmokeMfaVerifyProps = {
  email?: string;
  brand?: string;
  headline?: string;
  headlineSubtext?: string;
  title?: string;
  subtitle?: string;
  backHref?: string;
  cooldownSeconds?: number;
  /** Chamado com o código de 6 dígitos validado. */
  onSubmit?: (values: SmokeMfaFormValues) => void | Promise<void>;
  onResendCode?: () => void | Promise<void>;
  defaultTheme?: AuthTheme;
  className?: string;
};

function formatCooldown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function SmokeMfaVerify({
  email,
  brand = "Minha Carteira",
  headline = "Segurança em cada acesso.",
  headlineSubtext = "Confirme seu e-mail para proteger suas finanças desde o início.",
  title = "Verifique seu e-mail",
  subtitle,
  backHref = "/login",
  cooldownSeconds = DEFAULT_RESEND_COOLDOWN_SECONDS,
  onSubmit,
  onResendCode,
  defaultTheme = "light",
  className,
}: SmokeMfaVerifyProps) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: MFA_CODE_LENGTH }, () => ""),
  );
  const [busy, setBusy] = useState<null | "verify" | "resend">(null);
  const [cooldown, setCooldown] = useState<number>(cooldownSeconds);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const reduce = useReducedMotion();
  const persistedEmail = usePendingAuthEmail();

  useEffect(() => {
    const trimmed = email?.trim();
    if (trimmed) {
      savePendingAuthEmail(trimmed);
    }
  }, [email]);

  const groupId = useId();
  const codeErrorId = useId();

  const {
    handleSubmit,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<SmokeMfaFormValues>({
    resolver: zodResolver(mfaFormSchema),
    defaultValues: {
      code: "",
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((current) => (current > 1 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const updateDigits = (nextDigits: string[]) => {
    setDigits(nextDigits);
    setStatusMessage(null);
    setValue("code", nextDigits.join(""), {
      shouldValidate: isSubmitted,
    });
  };

  const focusInput = (index: number) => {
    const clamped = Math.max(0, Math.min(index, MFA_CODE_LENGTH - 1));
    inputsRef.current[clamped]?.focus();
  };

  const applyCodeChunk = (startIndex: number, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, "");
    if (!cleaned) return false;

    const nextDigits = [...digits];
    // Se colar um código completo em qualquer campo, preenche desde o início.
    const offset = cleaned.length >= MFA_CODE_LENGTH ? 0 : startIndex;
    const chars = cleaned.slice(0, MFA_CODE_LENGTH - offset).split("");

    chars.forEach((char, idx) => {
      nextDigits[offset + idx] = char;
    });

    updateDigits(nextDigits);
    const nextFocus = Math.min(offset + chars.length, MFA_CODE_LENGTH - 1);
    focusInput(nextFocus);
    return true;
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, "");

    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      updateDigits(nextDigits);
      return;
    }

    if (cleaned.length > 1) {
      applyCodeChunk(index, cleaned);
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = cleaned;
    updateDigits(nextDigits);

    if (index < MFA_CODE_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleDigitKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const nextDigits = [...digits];
      nextDigits[index - 1] = "";
      updateDigits(nextDigits);
      focusInput(index - 1);
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < MFA_CODE_LENGTH - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  };

  const handleDigitPaste = (
    index: number,
    event: ClipboardEvent<HTMLInputElement>,
  ) => {
    const pasted = event.clipboardData.getData("text");
    if (applyCodeChunk(index, pasted)) {
      event.preventDefault();
    }
  };

  const submitForm = handleSubmit(async (values) => {
    if (busy) return;
    setBusy("verify");
    setStatusMessage(null);
    try {
      if (onSubmit) {
        await onSubmit(values);
        return;
      }

      const pendingChallenge = readPendingMfaChallenge();
      if (!pendingChallenge?.challengeId) {
        setStatusMessage(
          "Solicite um novo código de verificação para continuar.",
        );
        return;
      }

      const result = await authService.validateMfa({
        challengeId: pendingChallenge.challengeId,
        code: values.code,
      });

      if (result.isRegistered) {
        clearPendingAuthSession();
        router.push("/accounts");
      } else {
        const targetEmail = email?.trim() || persistedEmail;
        router.push(
          targetEmail
            ? `/register?email=${encodeURIComponent(targetEmail)}`
            : "/register",
        );
      }
    } catch (error) {
      setStatusMessage(
        error instanceof ApiClientError
          ? error.message
          : "Não foi possível validar o código de verificação.",
      );
    } finally {
      setBusy(null);
    }
  });

  const handleResend = async () => {
    if (busy || cooldown > 0) return;
    setBusy("resend");
    setStatusMessage(null);
    try {
      if (onResendCode) {
        await onResendCode();
      } else {
        const targetEmail = email?.trim() || persistedEmail;
        if (!targetEmail) {
          setStatusMessage("Informe seu e-mail novamente na tela de acesso.");
          return;
        }
        const result = await authService.requestMfa({ email: targetEmail });
        savePendingMfaChallenge({
          challengeId: result.challengeId,
          nextAttemptAt: result.nextAttemptAt,
        });
      }
      setCooldown(cooldownSeconds);
      setStatusMessage("Um novo código de verificação foi enviado.");
    } catch (error) {
      setStatusMessage(
        error instanceof ApiClientError
          ? error.message
          : "Não foi possível reenviar o código de verificação.",
      );
    } finally {
      setBusy(null);
    }
  };

  const sanitizedEmail = email?.trim() || persistedEmail;

  return (
    <AuthSmokeShell
      brand={brand}
      headline={headline}
      headlineSubtext={headlineSubtext}
      defaultTheme={defaultTheme}
      className={className}
    >
      <motion.div {...createRiseMotion(reduce, 1)} className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>{sanitizedEmail ? "Alterar e-mail" : "Voltar para o login"}</span>
        </Link>
      </motion.div>

      <motion.h1
        {...createRiseMotion(reduce, 2)}
        className="text-[34px] font-semibold leading-none tracking-[-0.045em]"
      >
        {title}
      </motion.h1>

      <motion.p
        {...createRiseMotion(reduce, 3)}
        className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]"
      >
        {subtitle ? (
          subtitle
        ) : sanitizedEmail ? (
          <>
            Enviamos um código de 6 dígitos para{" "}
            <span className="font-medium text-[var(--ink)] break-all">
              {sanitizedEmail}
            </span>
            .
          </>
        ) : (
          "Digite o código de 6 dígitos enviado para o seu e-mail."
        )}
      </motion.p>

      <form onSubmit={submitForm} noValidate className="mt-8 space-y-5">
        <motion.div {...createRiseMotion(reduce, 4)}>
          <AuthLabel htmlFor={`${groupId}-0`}>Código de verificação</AuthLabel>

          <div
            role="group"
            aria-label="Código de verificação de 6 dígitos"
            aria-describedby={errors.code ? codeErrorId : undefined}
            className="mt-2 grid grid-cols-6 gap-2 sm:gap-2.5"
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                id={`${groupId}-${index}`}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={MFA_CODE_LENGTH}
                value={digit}
                disabled={!!busy}
                aria-label={`Dígito ${index + 1} de ${MFA_CODE_LENGTH}`}
                aria-invalid={errors.code ? "true" : "false"}
                onChange={(event) => handleDigitChange(index, event.target.value)}
                onKeyDown={(event) => handleDigitKeyDown(index, event)}
                onPaste={(event) => handleDigitPaste(index, event)}
                onFocus={(event) => event.currentTarget.select()}
                className={cn(
                  "h-12 w-full rounded-[14px] border border-[var(--line)] bg-[var(--field)] text-center font-mono text-[18px] font-semibold tabular-nums text-[var(--ink)] shadow-[0_1px_2px_rgb(1_32_72/0.04)_inset] outline-none transition-[border-color,box-shadow,background-color] duration-300 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-70",
                  errors.code &&
                    "border-[var(--error)] focus:border-[var(--error)]",
                )}
              />
            ))}
          </div>

          {errors.code && (
            <p
              id={codeErrorId}
              role="alert"
              className="mt-2 text-[12px] font-medium text-[var(--error)]"
            >
              {errors.code.message}
            </p>
          )}
        </motion.div>

        {statusMessage && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="flex items-start gap-2 rounded-[14px] border border-[var(--accent)]/35 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--ink)]"
          >
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-[var(--accent)]"
              aria-hidden="true"
            />
            <span>{statusMessage}</span>
          </motion.div>
        )}

        <motion.div {...createRiseMotion(reduce, 5)} className="pt-1">
          <button
            type="submit"
            disabled={!!busy}
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            {busy === "verify" ? (
              <LoaderCircle className="size-[18px] animate-spin" />
            ) : (
              "Verificar código"
            )}
          </button>
        </motion.div>
      </form>

      <motion.div
        {...createRiseMotion(reduce, 6)}
        className="mt-5 text-center text-[13px] text-[var(--muted)]"
      >
        <span>Não recebeu o código? </span>
        {cooldown > 0 ? (
          <span className="font-medium tabular-nums text-[var(--ink)]/75">
            Reenviar em {formatCooldown(cooldown)}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={!!busy}
            className="cursor-pointer font-medium text-[var(--ink)] underline underline-offset-2 transition-colors hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {busy === "resend" ? "Reenviando..." : "Reenviar código"}
          </button>
        )}
      </motion.div>
    </AuthSmokeShell>
  );
}
