import {
  ACCOUNT_REACTIVATION_MAX_ATTEMPTS,
  ACCOUNT_REACTIVATION_TOKEN_TTL_MS,
  MFA_CODE_TTL_MS,
  MFA_MAX_ATTEMPTS,
  MFA_RATE_LIMIT_MAX_REQUESTS,
  MFA_RATE_LIMIT_WINDOW_MS,
  MFA_RESEND_COOLDOWN_MS,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "./auth.constants.js";
import { ChallengePurpose, ChallengeSubjectType } from "../enums/auth.enums.js";

/** Política declarativa que torna explícito o contrato de cada finalidade na tabela `challenges`. */
export interface ChallengeFlowPolicy {
  readonly purpose: ChallengePurpose;
  readonly allowedSubjectTypes: readonly ChallengeSubjectType[];
  readonly requiresSubjectId: boolean;
  readonly requiresTargetEmail: boolean;
  readonly codeTtlMs: number;
  readonly maxAttempts: number;
  readonly resendCooldownMs: number | null;
  readonly rateLimitWindowMs: number | null;
  readonly maxRequestsInWindow: number | null;
}

/** Mapa exaustivo de regras por finalidade de desafio (`ChallengePurpose`). */
export const CHALLENGE_FLOW_POLICIES: Record<ChallengePurpose, ChallengeFlowPolicy> = {
  [ChallengePurpose.PASSWORD_RESET]: {
    purpose: ChallengePurpose.PASSWORD_RESET,
    allowedSubjectTypes: [ChallengeSubjectType.USER],
    requiresSubjectId: true,
    requiresTargetEmail: false,
    codeTtlMs: PASSWORD_RESET_TOKEN_TTL_MS,
    maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
    resendCooldownMs: null,
    rateLimitWindowMs: null,
    maxRequestsInWindow: null,
  },
  [ChallengePurpose.ACCOUNT_REACTIVATION]: {
    purpose: ChallengePurpose.ACCOUNT_REACTIVATION,
    allowedSubjectTypes: [ChallengeSubjectType.USER],
    requiresSubjectId: true,
    requiresTargetEmail: false,
    codeTtlMs: ACCOUNT_REACTIVATION_TOKEN_TTL_MS,
    maxAttempts: ACCOUNT_REACTIVATION_MAX_ATTEMPTS,
    resendCooldownMs: null,
    rateLimitWindowMs: null,
    maxRequestsInWindow: null,
  },
  [ChallengePurpose.EMAIL_VERIFICATION]: {
    purpose: ChallengePurpose.EMAIL_VERIFICATION,
    allowedSubjectTypes: [ChallengeSubjectType.EMAIL],
    requiresSubjectId: false,
    requiresTargetEmail: true,
    codeTtlMs: MFA_CODE_TTL_MS,
    maxAttempts: MFA_MAX_ATTEMPTS,
    resendCooldownMs: MFA_RESEND_COOLDOWN_MS,
    rateLimitWindowMs: MFA_RATE_LIMIT_WINDOW_MS,
    maxRequestsInWindow: MFA_RATE_LIMIT_MAX_REQUESTS,
  },
  [ChallengePurpose.MESSAGING_IDENTITY_VERIFICATION]: {
    purpose: ChallengePurpose.MESSAGING_IDENTITY_VERIFICATION,
    allowedSubjectTypes: [ChallengeSubjectType.MESSAGING_IDENTITY],
    requiresSubjectId: true,
    requiresTargetEmail: false,
    codeTtlMs: MFA_CODE_TTL_MS,
    maxAttempts: MFA_MAX_ATTEMPTS,
    resendCooldownMs: null,
    rateLimitWindowMs: null,
    maxRequestsInWindow: null,
  },
};

export function assertChallengeMatchesPolicy(input: {
  purpose: ChallengePurpose;
  subjectType: ChallengeSubjectType;
  subjectId: string | null;
  targetEmail: string | null;
}): void {
  const policy = CHALLENGE_FLOW_POLICIES[input.purpose];
  if (!policy.allowedSubjectTypes.includes(input.subjectType)) {
    throw new Error("Tipo do sujeito incompatível com a finalidade do desafio.");
  }
  if (policy.requiresSubjectId && !input.subjectId) {
    throw new Error("O ID do sujeito do desafio é obrigatório para esta finalidade.");
  }
  if (!policy.requiresSubjectId && input.subjectId !== null) {
    throw new Error("O ID do sujeito do desafio deve ser nulo para esta finalidade.");
  }
  if (policy.requiresTargetEmail && !input.targetEmail) {
    throw new Error("O e-mail alvo do desafio é obrigatório para esta finalidade.");
  }
  if (!policy.requiresTargetEmail && input.targetEmail !== null) {
    throw new Error("O e-mail alvo do desafio deve ser nulo para esta finalidade.");
  }
}
