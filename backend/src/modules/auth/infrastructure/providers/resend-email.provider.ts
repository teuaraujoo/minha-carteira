import { Resend } from "resend";
import type { EmailProvider, PasswordChangedEmail, PasswordResetEmail } from "../../application/contracts/auth.contracts.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly client: Pick<Resend, "emails">,
    private readonly sender: string,
  ) {
    if (!sender.trim()) throw new Error("O remetente do e-mail é obrigatório.");
  }

  async sendPasswordReset(input: PasswordResetEmail): Promise<void> {
    await this.send({
      to: input.email,
      subject: "Redefinição de senha — Minha Carteira",
      text: `Para redefinir sua senha, acesse: ${input.resetUrl}\n\nSe você não solicitou essa alteração, ignore esta mensagem.`,
      html: `<p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${escapeHtml(input.resetUrl)}">Criar nova senha</a></p><p>Se você não solicitou essa alteração, ignore esta mensagem.</p>`,
    });
  }

  async sendPasswordChanged(input: PasswordChangedEmail): Promise<void> {
    await this.send({
      to: input.email,
      subject: "Senha alterada — Minha Carteira",
      text: "Sua senha foi alterada. Se você não reconhece esta alteração, entre em contato com o suporte.",
      html: "<p>Sua senha foi alterada.</p><p>Se você não reconhece esta alteração, entre em contato com o suporte.</p>",
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}
