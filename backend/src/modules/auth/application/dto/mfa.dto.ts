import type { RequestMetadata } from "../../domain/interfaces/auth.interfaces.js";

export interface RequestMfaInput {
  email: string;
  metadata: RequestMetadata;
}

export interface RequestMfaOutput {
  sent: true;
  challengeId: string;
  nextAttemptAt: Date;
}

export interface ValidateMfaInput {
  challengeId: string;
  code: string;
  metadata: RequestMetadata;
}

export interface ValidateMfaOutput {
  accessToken: string;
  refreshToken?: string | undefined;
  isRegistered: boolean;
}

export interface ValidateMfaPublicOutput {
  accessToken: string;
  isRegistered: boolean;
}

export function mapRequestMfaOutput(output: RequestMfaOutput): { sent: true; challengeId: string; nextAttemptAt: string } {
  return {
    sent: output.sent,
    challengeId: output.challengeId,
    nextAttemptAt: output.nextAttemptAt.toISOString(),
  };
}

export function mapValidateMfaOutput(output: ValidateMfaOutput): ValidateMfaPublicOutput {
  return {
    accessToken: output.accessToken,
    isRegistered: output.isRegistered,
  };
}
