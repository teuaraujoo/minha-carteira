export interface PasswordResetEmail {
    email: string;
    resetUrl: string;
}

export interface PasswordChangedEmail {
    email: string;
}

export interface AccountReactivationEmail {
    email: string;
    reactivationUrl: string;
}

export interface MfaCodeEmail {
    email: string;
    code: string;
    expiresInMinutes: number;
}