import { readFile } from "node:fs/promises";

export interface RenderedEmailTemplate {
  html: string;
  text: string;
}

type AuthEmailTemplateName =
  | "password-reset.html"
  | "password-changed.html"
  | "account-reactivation.html"
  | "mfa-code.html";

export class AuthEmailTemplates {
  private readonly templateCache = new Map<AuthEmailTemplateName, Promise<string>>();

  async passwordReset(resetUrl: string): Promise<RenderedEmailTemplate> {
    const safeUrl = validateLink(resetUrl);
    return {
      html: await this.render("password-reset.html", { RESET_URL: safeUrl }),
      text: `Para redefinir sua senha, acesse: ${safeUrl}\n\nSe você não solicitou essa alteração, ignore esta mensagem.`,
    };
  }

  async passwordChanged(): Promise<RenderedEmailTemplate> {
    return {
      html: await this.render("password-changed.html"),
      text: "Sua senha foi alterada. Se você não reconhece essa alteração, solicite uma nova redefinição de senha e revise a segurança da sua conta.",
    };
  }

  async accountReactivation(reactivationUrl: string): Promise<RenderedEmailTemplate> {
    const safeUrl = validateLink(reactivationUrl);
    return {
      html: await this.render("account-reactivation.html", { REACTIVATION_URL: safeUrl }),
      text: `Para reativar sua conta, acesse: ${safeUrl}\n\nSe você não solicitou essa alteração, ignore esta mensagem.`,
    };
  }

  async mfaCode(code: string, expiresInMinutes: number): Promise<RenderedEmailTemplate> {
    const trimmedCode = code.trim();
    if (!trimmedCode) throw new Error("O código de verificação é obrigatório.");
    if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 1) {
      throw new Error("O tempo de expiração do código deve ser um inteiro positivo.");
    }
    return {
      html: await this.render("mfa-code.html", {
        CODE: trimmedCode,
        EXPIRES_IN_MINUTES: String(expiresInMinutes),
      }),
      text: `Seu código de verificação do Minha Carteira é: ${trimmedCode}\n\nEste código expira em ${expiresInMinutes} minutos.\nSe você não solicitou este código, ignore esta mensagem.`,
    };
  }

  private async render(
    templateName: AuthEmailTemplateName,
    variables: Readonly<Record<string, string>> = {},
  ): Promise<string> {
    let templatePromise = this.templateCache.get(templateName);
    if (!templatePromise) {
      templatePromise = readFile(new URL(`./templates/${templateName}`, import.meta.url), "utf8");
      this.templateCache.set(templateName, templatePromise);
    }

    const template = await templatePromise;
    const rendered = template.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, name: string) => {
      const value = variables[name];
      if (value === undefined) {
        throw new Error(`O valor do marcador ${placeholder} não foi informado.`);
      }
      return escapeHtml(value);
    });

    if (/\{\{[A-Z_]+\}\}/.test(rendered)) {
      throw new Error("O template de e-mail contém marcadores sem substituição.");
    }

    return rendered;
  }
}

function validateLink(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("O link do e-mail é inválido.");
  }

  const localHttp = url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("O link do e-mail deve usar HTTPS.");
  }

  return value;
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
