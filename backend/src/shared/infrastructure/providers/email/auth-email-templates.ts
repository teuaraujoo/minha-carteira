import { readFile } from "node:fs/promises";

export interface EmailInlineAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  contentId: string;
}

export interface RenderedEmailTemplate {
  html: string;
  text: string;
  attachments?: EmailInlineAttachment[];
}

type AuthEmailTemplateName =
  | "password-reset.html"
  | "password-changed.html"
  | "account-reactivation.html"
  | "mfa-code.html";

type LayoutTemplateName = "layout.html" | AuthEmailTemplateName;

const EMAIL_LOGO_CONTENT_ID = "minha-carteira-logo";
const EMAIL_LOGO_FILENAME = "logo.png";
const EMAIL_LOGO_CONTENT_TYPE = "image/png";

export class AuthEmailTemplates {
  private readonly templateCache = new Map<LayoutTemplateName, Promise<string>>();
  private logoCache?: Promise<Buffer>;

  async passwordReset(resetUrl: string): Promise<RenderedEmailTemplate> {
    const safeUrl = validateLink(resetUrl);
    return this.buildEmail({
      templateName: "password-reset.html",
      title: "Redefinição de senha — Minha Carteira",
      preheader: "Use o link para criar uma nova senha para sua conta.",
      variables: { RESET_URL: safeUrl },
      text: `Para redefinir sua senha, acesse: ${safeUrl}\n\nSe você não solicitou essa alteração, ignore esta mensagem.`,
    });
  }

  async passwordChanged(): Promise<RenderedEmailTemplate> {
    return this.buildEmail({
      templateName: "password-changed.html",
      title: "Senha alterada — Minha Carteira",
      preheader: "Sua senha do Minha Carteira foi alterada.",
      text: "Sua senha foi alterada. Se você não reconhece essa alteração, solicite uma nova redefinição de senha e revise a segurança da sua conta.",
    });
  }

  async accountReactivation(reactivationUrl: string): Promise<RenderedEmailTemplate> {
    const safeUrl = validateLink(reactivationUrl);
    return this.buildEmail({
      templateName: "account-reactivation.html",
      title: "Reativação da conta — Minha Carteira",
      preheader: "Confirme a reativação da sua conta.",
      variables: { REACTIVATION_URL: safeUrl },
      text: `Para reativar sua conta, acesse: ${safeUrl}\n\nSe você não solicitou essa alteração, ignore esta mensagem.`,
    });
  }

  async mfaCode(code: string, expiresInMinutes: number): Promise<RenderedEmailTemplate> {
    const trimmedCode = code.trim();
    if (!trimmedCode) throw new Error("O código de verificação é obrigatório.");
    if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 1) {
      throw new Error("O tempo de expiração do código deve ser um inteiro positivo.");
    }
    return this.buildEmail({
      templateName: "mfa-code.html",
      title: "Código de verificação — Minha Carteira",
      preheader: `Use o código ${trimmedCode} para continuar no Minha Carteira.`,
      variables: {
        CODE: trimmedCode,
        EXPIRES_IN_MINUTES: String(expiresInMinutes),
      },
      text: `Seu código de verificação do Minha Carteira é: ${trimmedCode}\n\nEste código expira em ${expiresInMinutes} minutos.\nSe você não solicitou este código, ignore esta mensagem.`,
    });
  }

  private async buildEmail(input: {
    templateName: AuthEmailTemplateName;
    title: string;
    preheader: string;
    text: string;
    variables?: Readonly<Record<string, string>>;
  }): Promise<RenderedEmailTemplate> {
    const [bodyHtml, layoutHtml, logoContent] = await Promise.all([
      this.renderFragment(input.templateName, input.variables),
      this.loadTemplate("layout.html"),
      this.loadLogo(),
    ]);

    const html = replacePlaceholders(layoutHtml, {
      TITLE: escapeHtml(input.title),
      PREHEADER: escapeHtml(input.preheader),
      LOGO_CID: escapeHtml(EMAIL_LOGO_CONTENT_ID),
      CONTENT: bodyHtml,
    });

    return {
      html,
      text: input.text,
      attachments: [
        {
          filename: EMAIL_LOGO_FILENAME,
          content: logoContent,
          contentType: EMAIL_LOGO_CONTENT_TYPE,
          contentId: EMAIL_LOGO_CONTENT_ID,
        },
      ],
    };
  }

  private async renderFragment(
    templateName: AuthEmailTemplateName,
    variables: Readonly<Record<string, string>> = {},
  ): Promise<string> {
    const template = await this.loadTemplate(templateName);
    const escapedVariables = Object.fromEntries(
      Object.entries(variables).map(([key, value]) => [key, escapeHtml(value)]),
    );
    return replacePlaceholders(template, escapedVariables);
  }

  private loadTemplate(templateName: LayoutTemplateName): Promise<string> {
    let templatePromise = this.templateCache.get(templateName);
    if (!templatePromise) {
      templatePromise = readFile(new URL(`./templates/${templateName}`, import.meta.url), "utf8");
      this.templateCache.set(templateName, templatePromise);
    }
    return templatePromise;
  }

  private loadLogo(): Promise<Buffer> {
    if (!this.logoCache) {
      this.logoCache = readFile(
        new URL(`./templates/assets/${EMAIL_LOGO_FILENAME}`, import.meta.url),
      );
    }
    return this.logoCache;
  }
}

function replacePlaceholders(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  const rendered = template.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) {
      throw new Error(`O valor do marcador ${placeholder} não foi informado.`);
    }
    return value;
  });

  if (/\{\{[A-Z_]+\}\}/.test(rendered)) {
    throw new Error("O template de e-mail contém marcadores sem substituição.");
  }

  return rendered;
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
