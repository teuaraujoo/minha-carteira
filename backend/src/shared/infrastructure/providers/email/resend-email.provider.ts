import { Resend } from "resend";
import { AppError, ErrorCode } from "../../../presentation/http/app-error.js";
import type { EmailProvider } from "../../../application/contracts/email-provider.contract.js";
import type { AccountReactivationEmail, PasswordChangedEmail, PasswordResetEmail } from "../../../application/interfaces/auth-emails.interfaces.js";
import { AuthEmailTemplates } from "./auth-email-templates.js";

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly client: Pick<Resend, "emails">,
    private readonly sender: string,
    private readonly templates = new AuthEmailTemplates(),
  ) {
    if (!sender.trim()) throw new Error("O remetente do e-mail é obrigatório.");
  }

  async sendPasswordReset(input: PasswordResetEmail): Promise<void> {
    const content = await this.templates.passwordReset(input.resetUrl);
    await this.send({
      to: input.email,
      subject: "Redefinição de senha — Minha Carteira",
      ...content,
    });
  }

  async sendPasswordChanged(input: PasswordChangedEmail): Promise<void> {
    const content = await this.templates.passwordChanged();
    await this.send({
      to: input.email,
      subject: "Senha alterada — Minha Carteira",
      ...content,
    });
  }

  async sendAccountReactivation(input: AccountReactivationEmail): Promise<void> {
    const content = await this.templates.accountReactivation(input.reactivationUrl);
    await this.send({
      to: input.email,
      subject: "Reativação da conta — Minha Carteira",
      ...content,
    });
  }

  private async send(input: { to: string; subject: string; text: string; html: string }): Promise<void> {
    try {
      const result = await this.client.emails.send({ from: this.sender, ...input });
      if (result.error || !result.data?.id) throw new Error("O Resend não confirmou o envio.");
    } catch {
      throw new AppError({
        status: 502,
        code: ErrorCode.INTERNAL_ERROR,
        message: "Não foi possível enviar o e-mail de autenticação.",
      });
    }
  }
}
