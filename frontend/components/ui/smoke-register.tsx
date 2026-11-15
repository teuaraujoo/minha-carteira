"use client";

import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import { Controller, useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import {
  AUTH_FIELD_CLASS,
  AUTH_GRAIN,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_THEMES,
  AuthLabel,
  ThemeSwitch,
  createRiseMotion,
  type AuthTheme,
} from "@/components/ui/auth-smoke-shell";
import {
  savePendingAuthEmail,
  usePendingAuthEmail,
} from "@/lib/auth-onboarding-storage";
import { cn } from "@/lib/utils";

const STEP_COUNT = 2;

const registerFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(5, "Informe seu nome completo (mínimo de 5 caracteres)."),
    username: z
      .string()
      .trim()
      .min(5, "Nome de usuário deve ter pelo menos 5 caracteres.")
      .refine(
        (value) => !value.includes("@"),
        "Nome de usuário não pode conter @.",
      ),
    phone: z
      .string()
      .trim()
      .refine(
        (value) => /^\d{2}9\d{8}$/.test(value.replace(/\D/g, "")),
        "Informe um celular brasileiro válido com DDD e 9 dígitos.",
      ),
    password: z
      .string()
      .min(8, "A senha deve possuir pelo menos 8 caracteres."),
    passwordConfirmation: z
      .string()
      .min(1, "Confirme sua senha."),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "A senha e a confirmação devem corresponder.",
    path: ["passwordConfirmation"],
  });

type RegisterFormFields = z.infer<typeof registerFormSchema>;

export type SmokeRegisterPayload = {
  username: string;
  phone: string;
  email?: string;
  password: string;
  name: string;
};

export type SmokeRegisterProps = {
  brand?: string;
  initialEmail?: string;
  loginHref?: string;
  /** Chamado com os dados validados e normalizados para o contrato da aplicação. */
  onSubmit?: (values: SmokeRegisterPayload) => void | Promise<void>;
  defaultTheme?: AuthTheme;
  className?: string;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function formatBrMobileMask(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function SmokeRegister({
  brand = "Minha Carteira",
  initialEmail = "",
  loginHref = "/login",
  onSubmit,
  defaultTheme = "light",
  className,
}: SmokeRegisterProps) {
  const [theme, setTheme] = useState<AuthTheme>(defaultTheme);
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const dark = theme === "dark";
  const persistedEmail = usePendingAuthEmail();

  useEffect(() => {
    const trimmed = initialEmail.trim();
    if (trimmed) {
      savePendingAuthEmail(trimmed);
    }
  }, [initialEmail]);

  const resolvedEmail = initialEmail.trim().toLowerCase() || persistedEmail;

  const nameId = useId();
  const nameErrorId = useId();
  const usernameId = useId();
  const usernameErrorId = useId();
  const phoneId = useId();
  const phoneErrorId = useId();
  const passwordId = useId();
  const passwordErrorId = useId();
  const passwordConfirmationId = useId();
  const passwordConfirmationErrorId = useId();

  const {
    control,
    register,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormFields>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      username: "",
      phone: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  const handleNextStep = async () => {
    setStatusMessage(null);
    const valid = await trigger(["name", "username", "phone"]);
    if (valid) {
      setStep(2);
    }
  };

  const submitForm = handleSubmit(async (values) => {
    if (busy) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const payload: SmokeRegisterPayload = {
        name: values.name.trim(),
        username: values.username.trim().toLowerCase(),
        phone: `+55${values.phone.replace(/\D/g, "")}`,
        email: resolvedEmail || undefined,
        password: values.password,
      };

      if (onSubmit) {
        await onSubmit(payload);
        return;
      }

      // Fluxo visual: validação local dos dados sem integração com o backend.
      await wait(700);
      setStatusMessage(
        "Dados de cadastro validados na interface. A integração com o backend será conectada na próxima etapa.",
      );
    } finally {
      setBusy(false);
    }
  });

  return (
    <main
      style={AUTH_THEMES[theme] as CSSProperties}
      className={cn(
        "relative flex min-h-dvh w-full flex-col justify-between overflow-x-clip bg-[var(--bg)] font-sans text-[var(--ink)] transition-colors duration-700",
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

      {/* ---- Cabeçalho superior com marca, indicador de etapa e tema ---- */}
      <header className="relative z-10 flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
        <Link
          href={loginHref}
          className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-[-0.02em] text-[var(--ink)] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          <Image
            src="/favicon.png"
            alt={brand}
            width={24}
            height={24}
            className="size-6 rounded-md object-contain"
            priority
          />
          <span className="hidden sm:inline">{brand}</span>
        </Link>

        <div
          role="progressbar"
          aria-label="Progresso do cadastro"
          aria-valuemin={1}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={step}
          className="flex items-center gap-2"
        >
          {[1, 2].map((index) => {
            const active = index === step;
            return (
              <span
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  active
                    ? "w-7 bg-[var(--accent)]"
                    : "w-1.5 bg-[var(--muted)]/35",
                )}
              />
            );
          })}
        </div>

        <ThemeSwitch
          theme={theme}
          onToggle={() => setTheme(dark ? "light" : "dark")}
          className="static sm:static"
        />
      </header>

      {/* ---- Conteúdo centralizado: emblema, título e campos da etapa ---- */}
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <motion.div
            {...createRiseMotion(reduce, 0)}
            className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-[0_6px_20px_-6px_rgb(1_32_72/0.14),0_0_24px_-8px_color-mix(in_oklab,var(--accent)_45%,transparent)]"
          >
            {step === 1 ? (
              <UserRound
                className="size-5 text-[var(--accent)]"
                aria-hidden="true"
              />
            ) : (
              <KeyRound
                className="size-5 text-[var(--accent)]"
                aria-hidden="true"
              />
            )}
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`heading-${step}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.035em] sm:text-[30px]">
                {step === 1 ? "Dados pessoais" : "Dados de acesso"}
              </h1>
              <p className="mt-2 text-[14px] text-[var(--muted)]">
                {step === 1
                  ? "Para iniciar, precisamos de alguns dados do proprietário da conta."
                  : "Crie uma senha segura para concluir o cadastro da sua conta."}
              </p>
            </motion.div>
          </AnimatePresence>

          <form
            id="smoke-register-form"
            onSubmit={submitForm}
            noValidate
            className="mt-8"
          >
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div
                  key="step-1"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <div>
                    <AuthLabel htmlFor={nameId}>Nome</AuthLabel>
                    <input
                      id={nameId}
                      type="text"
                      autoComplete="name"
                      placeholder="Seu nome completo"
                      aria-invalid={errors.name ? "true" : "false"}
                      aria-describedby={errors.name ? nameErrorId : undefined}
                      className={cn(
                        AUTH_FIELD_CLASS,
                        errors.name &&
                          "border-[var(--error)] focus:border-[var(--error)]",
                      )}
                      {...register("name")}
                    />
                    {errors.name && (
                      <p
                        id={nameErrorId}
                        role="alert"
                        className="mt-1.5 text-[12px] font-medium text-[var(--error)]"
                      >
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <AuthLabel htmlFor={usernameId}>Nome de usuário</AuthLabel>
                    <input
                      id={usernameId}
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="seu.usuario"
                      aria-invalid={errors.username ? "true" : "false"}
                      aria-describedby={
                        errors.username ? usernameErrorId : undefined
                      }
                      className={cn(
                        AUTH_FIELD_CLASS,
                        errors.username &&
                          "border-[var(--error)] focus:border-[var(--error)]",
                      )}
                      {...register("username")}
                    />
                    {errors.username && (
                      <p
                        id={usernameErrorId}
                        role="alert"
                        className="mt-1.5 text-[12px] font-medium text-[var(--error)]"
                      >
                        {errors.username.message}
                      </p>
                    )}
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
                      Solicitamos um nome de usuário exclusivo para identificar
                      seu perfil no Minha Carteira. Use ao menos 5 caracteres e
                      não utilize @.
                    </p>
                  </div>

                  <div>
                    <AuthLabel htmlFor={phoneId}>Telefone</AuthLabel>
                    <Controller
                      control={control}
                      name="phone"
                      render={({ field }) => (
                        <div
                          className={cn(
                            "mt-2 flex h-12 w-full items-center overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--field)] shadow-[0_1px_2px_rgb(1_32_72/0.04)_inset] transition-[border-color,box-shadow,background-color] duration-300 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)]",
                            errors.phone &&
                              "border-[var(--error)] focus-within:border-[var(--error)]",
                          )}
                        >
                          <span className="flex h-full items-center border-r border-[var(--line)] px-3.5 text-[14px] font-medium tabular-nums text-[var(--muted)] select-none">
                            +55
                          </span>
                          <input
                            id={phoneId}
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            placeholder="(00) 00000-0000"
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={(event) =>
                              field.onChange(
                                formatBrMobileMask(event.target.value),
                              )
                            }
                            aria-invalid={errors.phone ? "true" : "false"}
                            aria-describedby={
                              errors.phone ? phoneErrorId : undefined
                            }
                            className="h-full w-full bg-transparent px-3.5 text-[15px] tabular-nums text-[var(--ink)] outline-none placeholder:text-[var(--muted)]/60"
                          />
                        </div>
                      )}
                    />
                    {errors.phone && (
                      <p
                        id={phoneErrorId}
                        role="alert"
                        className="mt-1.5 text-[12px] font-medium text-[var(--error)]"
                      >
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="step-2"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 10 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <PasswordField
                    id={passwordId}
                    errorId={passwordErrorId}
                    label="Senha"
                    placeholder="Mínimo de 8 caracteres"
                    visible={showPassword}
                    onToggleVisibility={() => setShowPassword((prev) => !prev)}
                    error={errors.password?.message}
                    helperText="Utilize uma senha com pelo menos 8 caracteres para proteger o acesso à sua conta."
                    registration={register("password")}
                  />

                  <PasswordField
                    id={passwordConfirmationId}
                    errorId={passwordConfirmationErrorId}
                    label="Repetir senha"
                    placeholder="Digite a senha novamente"
                    visible={showPasswordConfirmation}
                    onToggleVisibility={() =>
                      setShowPasswordConfirmation((prev) => !prev)
                    }
                    error={errors.passwordConfirmation?.message}
                    registration={register("passwordConfirmation")}
                  />

                  {statusMessage && (
                    <div
                      role="status"
                      className="flex items-start gap-2 rounded-[14px] border border-[var(--accent)]/35 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--ink)]"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-[var(--accent)]"
                        aria-hidden="true"
                      />
                      <span>{statusMessage}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </section>

      {/* ---- Rodapé pontilhado com o botão principal de ação ---- */}
      <footer
        className="relative z-10 border-t border-[var(--line)]/80 px-5 py-8"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--ink) 11%, transparent) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      >
        <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-3">
          {step === 1 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className={AUTH_PRIMARY_BUTTON_CLASS}
            >
              <span>Continuar</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              form="smoke-register-form"
              disabled={busy}
              className={AUTH_PRIMARY_BUTTON_CLASS}
            >
              {busy ? (
                <LoaderCircle className="size-[18px] animate-spin" />
              ) : (
                <>
                  <span>Criar conta</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
          )}

          {step === 2 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStatusMessage(null);
                setStep(1);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Voltar para dados pessoais</span>
            </button>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">
              Já tem uma conta?{" "}
              <Link
                href={loginHref}
                className="font-medium text-[var(--ink)] underline underline-offset-2 transition-colors hover:text-[var(--accent)]"
              >
                Entrar
              </Link>
            </p>
          )}
        </div>
      </footer>
    </main>
  );
}

type PasswordFieldProps = {
  id: string;
  errorId: string;
  label: string;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  error?: string;
  helperText?: ReactNode;
  registration: UseFormRegisterReturn;
};

function PasswordField({
  id,
  errorId,
  label,
  placeholder,
  visible,
  onToggleVisibility,
  error,
  helperText,
  registration,
}: PasswordFieldProps) {
  return (
    <div>
      <AuthLabel htmlFor={id}>{label}</AuthLabel>
      <div className="relative mt-2">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            AUTH_FIELD_CLASS,
            "mt-0 pr-12",
            error && "border-[var(--error)] focus:border-[var(--error)]",
          )}
          {...registration}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-[12px] font-medium text-[var(--error)]"
        >
          {error}
        </p>
      )}
      {helperText && (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
          {helperText}
        </p>
      )}
    </div>
  );
}
