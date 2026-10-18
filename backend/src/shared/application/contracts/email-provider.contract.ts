import type { AccountReactivationEmail, PasswordChangedEmail, PasswordResetEmail } from "../interfaces/auth-emails.interfaces.js";

export interface EmailProvider {
    sendPasswordReset(input: PasswordResetEmail): Promise<void>;
    sendPasswordChanged(input: PasswordChangedEmail): Promise<void>;
    sendAccountReactivation(input: AccountReactivationEmail): Promise<void>;
}
