import assert from "node:assert/strict";
import test from "node:test";
import type { Resend } from "resend";
import { ResendEmailProvider } from "../../src/shared/infrastructure/providers/email/resend-email.provider.js";

function createClient(send: (input: Record<string, unknown>) => Promise<unknown>): Pick<Resend, "emails"> {
  return { emails: { send } } as unknown as Pick<Resend, "emails">;
}

test("Resend envia link de recuperação com conteúdo em português", async () => {
  let sent: Record<string, unknown> | undefined;
  const provider = new ResendEmailProvider(createClient(async (input) => { sent = input; return { data: { id: "email-1" }, error: null }; }), "Minha Carteira <conta@example.com>");
  await provider.sendPasswordReset({ email: "teco@example.com", resetUrl: "https://carteira.example/reset-password?token=challenge.secret" });

  assert.equal(sent?.to, "teco@example.com");
  assert.equal(sent?.from, "Minha Carteira <conta@example.com>");
  assert.match(String(sent?.subject), /Redefinição de senha/);
  assert.match(String(sent?.text), /challenge\.secret/);
  assert.match(String(sent?.html), /Criar nova senha/);
  assert.match(String(sent?.html), /https:\/\/carteira\.example\/reset-password\?token=challenge\.secret/);
});

test("Resend envia link de reativação com conteúdo em português", async () => {
  let sent: Record<string, unknown> | undefined;
  const provider = new ResendEmailProvider(createClient(async (input) => { sent = input; return { data: { id: "email-2" }, error: null }; }), "Minha Carteira <conta@example.com>");
  await provider.sendAccountReactivation({ email: "teco@example.com", reactivationUrl: "https://carteira.example/reactivate-account?token=challenge.secret" });

  assert.equal(sent?.to, "teco@example.com");
  assert.match(String(sent?.subject), /Reativação da conta/);
  assert.match(String(sent?.text), /challenge\.secret/);
  assert.match(String(sent?.html), /Reativar conta/);
  assert.match(String(sent?.html), /https:\/\/carteira\.example\/reactivate-account\?token=challenge\.secret/);
});

test("Resend envia template externo para aviso de senha alterada", async () => {
  let sent: Record<string, unknown> | undefined;
  const provider = new ResendEmailProvider(createClient(async (input) => { sent = input; return { data: { id: "email-3" }, error: null }; }), "Minha Carteira <conta@example.com>");
  await provider.sendPasswordChanged({ email: "teco@example.com" });

  assert.match(String(sent?.subject), /Senha alterada/);
  assert.match(String(sent?.html), /Sua senha foi alterada/);
  assert.match(String(sent?.text), /Sua senha foi alterada/);
});

test("templates não aceitam links com protocolo inseguro", async () => {
  const provider = new ResendEmailProvider(createClient(async () => ({ data: { id: "email-4" }, error: null })), "conta@example.com");
  await assert.rejects(
    provider.sendPasswordReset({ email: "teco@example.com", resetUrl: "javascript:alert(1)" }),
    /O link do e-mail deve usar HTTPS/,
  );
});

test("Resend rejeita falhas sem propagar dados sensíveis do provedor", async () => {
  const provider = new ResendEmailProvider(createClient(async () => ({ data: null, error: { message: "erro com chave privada" } })), "conta@example.com");
  await assert.rejects(provider.sendPasswordReset({ email: "teco@example.com", resetUrl: "https://carteira.example/?token=segredo" }), (error: Error) => {
    assert.equal(error.message, "Não foi possível enviar o e-mail de autenticação.");
    assert.equal(error.message.includes("segredo"), false);
    return true;
  });
});

test("Resend envia código MFA com expiração em português", async () => {
  let sent: Record<string, unknown> | undefined;
  const provider = new ResendEmailProvider(
    createClient(async (input) => { sent = input; return { data: { id: "email-mfa" }, error: null }; }),
    "Minha Carteira <conta@example.com>",
  );
  await provider.sendMfaCode({ email: "teco@example.com", code: "482910", expiresInMinutes: 5 });

  assert.equal(sent?.to, "teco@example.com");
  assert.match(String(sent?.subject), /Código de verificação/);
  assert.match(String(sent?.html), /482910/);
  assert.match(String(sent?.html), /5 minutos/);
  assert.match(String(sent?.text), /482910/);
  assert.match(String(sent?.text), /5 minutos/);
});

test("Resend inclui logo inline e identidade visual em todos os templates", async () => {
  const sentEmails: Array<Record<string, unknown>> = [];
  const provider = new ResendEmailProvider(
    createClient(async (input) => {
      sentEmails.push(input);
      return { data: { id: `email-${sentEmails.length}` }, error: null };
    }),
    "Minha Carteira <conta@example.com>",
  );

  await provider.sendPasswordReset({ email: "teco@example.com", resetUrl: "https://carteira.example/reset?t=1" });
  await provider.sendPasswordChanged({ email: "teco@example.com" });
  await provider.sendAccountReactivation({ email: "teco@example.com", reactivationUrl: "https://carteira.example/reactivate?t=1" });
  await provider.sendMfaCode({ email: "teco@example.com", code: "123456", expiresInMinutes: 5 });

  assert.equal(sentEmails.length, 4);
  for (const email of sentEmails) {
    const html = String(email.html);
    assert.match(html, /src="cid:minha-carteira-logo"/);
    assert.match(html, /#012048/);
    assert.match(html, /#00C7C4/);
    const attachments = email.attachments as Array<{
      filename?: string;
      content?: Buffer;
      contentType?: string;
      contentId?: string;
    }>;
    assert.equal(attachments?.length, 1);
    assert.equal(attachments[0]?.filename, "logo.png");
    assert.equal(attachments[0]?.contentType, "image/png");
    assert.equal(attachments[0]?.contentId, "minha-carteira-logo");
    assert.ok(Buffer.isBuffer(attachments[0]?.content) && attachments[0].content.length > 0);
  }
});

test("Resend exige remetente", () => {
  assert.throws(() => new ResendEmailProvider(createClient(async () => ({})), " "), /remetente do e-mail é obrigatório/);
});
