import assert from "node:assert/strict";
import test from "node:test";
import type { Resend } from "resend";
import { ResendEmailProvider } from "../../src/modules/auth/infrastructure/providers/resend-email.provider.js";

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
});

test("Resend envia link de reativação com conteúdo em português", async () => {
  let sent: Record<string, unknown> | undefined;
  const provider = new ResendEmailProvider(createClient(async (input) => { sent = input; return { data: { id: "email-2" }, error: null }; }), "Minha Carteira <conta@example.com>");
  await provider.sendAccountReactivation({ email: "teco@example.com", reactivationUrl: "https://carteira.example/reactivate-account?token=challenge.secret" });

  assert.equal(sent?.to, "teco@example.com");
  assert.match(String(sent?.subject), /Reativação da conta/);
  assert.match(String(sent?.text), /challenge\.secret/);
});

test("Resend rejeita falhas sem propagar dados sensíveis do provedor", async () => {
  const provider = new ResendEmailProvider(createClient(async () => ({ data: null, error: { message: "erro com chave privada" } })), "conta@example.com");
  await assert.rejects(provider.sendPasswordReset({ email: "teco@example.com", resetUrl: "https://carteira.example/?token=segredo" }), (error: Error) => {
    assert.equal(error.message, "Não foi possível enviar o e-mail de autenticação.");
    assert.equal(error.message.includes("segredo"), false);
    return true;
  });
});

test("Resend exige remetente", () => {
  assert.throws(() => new ResendEmailProvider(createClient(async () => ({})), " "), /remetente do e-mail é obrigatório/);
});
