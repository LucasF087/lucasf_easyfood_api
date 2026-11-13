// Serviço compartilhado de e-mail (atividade 6): montagem do HTML, chamada ao
// provedor, modo sem configuração e isolamento de falhas. O fetch é trocado
// por um dublê: nenhum e-mail real é enviado e nenhuma chave é necessária.

const test = require("node:test");
const assert = require("node:assert/strict");

const { installPrismaStub } = require("./helpers/prisma-stub");

// Hermético: o notification.service carrega o activity.service, que usa o Prisma.
installPrismaStub();

const emailService = require("../src/shared/email.service");

const PARTES = { subject: "Assunto", header: "Título", body: "Corpo do e-mail", footer: "Equipe EasyFood" };

const originalFetch = globalThis.fetch;
const KEYS = ["EMAIL_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME", "EMAIL_API_URL"];

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of KEYS) delete process.env[key];
});

function configurar() {
  process.env.EMAIL_API_KEY = "chave-falsa-de-teste";
  process.env.EMAIL_FROM = "no-reply@easyfood.example";
}

test("sem configuração, sendEmail não envia nada e informa skipped", async () => {
  let chamou = false;
  globalThis.fetch = async () => { chamou = true; };

  const r = await emailService.sendEmail({ to: "a@b.com", ...PARTES });

  assert.equal(r.skipped, true);
  assert.equal(r.sent, false);
  assert.equal(chamou, false);
});

test("configurado, envia ao provedor com Bearer, remetente e destinatário", async () => {
  configurar();
  let capturado;
  globalThis.fetch = async (url, options) => {
    capturado = { url, options };
    return { ok: true, status: 202 };
  };

  const r = await emailService.sendEmail({ to: "dono@x.com", toName: "Dono", ...PARTES });
  const corpo = JSON.parse(capturado.options.body);

  assert.equal(r.sent, true);
  assert.equal(capturado.url, "https://api.mailersend.com/v1/email");
  assert.equal(capturado.options.headers.Authorization, "Bearer chave-falsa-de-teste");
  assert.equal(corpo.from.email, "no-reply@easyfood.example");
  assert.equal(corpo.from.name, "EasyFood");
  assert.deepEqual(corpo.to, [{ email: "dono@x.com", name: "Dono" }]);
  assert.match(corpo.html, /<h2>Título<\/h2>/);
  assert.match(corpo.html, /Corpo do e-mail/);
  assert.match(corpo.html, /<small>Equipe EasyFood<\/small>/);
  assert.equal(corpo.text, "Título\n\nCorpo do e-mail\n\nEquipe EasyFood");
  assert.equal(corpo.subject, "Assunto");
});

test("resposta de erro do provedor vira exceção sem vazar a chave", async () => {
  configurar();
  globalThis.fetch = async () => ({ ok: false, status: 422, text: async () => "chave-falsa-de-teste" });

  await assert.rejects(
    () => emailService.sendEmail({ to: "a@b.com", ...PARTES }),
    (error) => /422/.test(error.message) && !error.message.includes("chave-falsa")
  );
});

test("sendEmail valida os parâmetros obrigatórios", async () => {
  await assert.rejects(() => emailService.sendEmail({ ...PARTES }));
  for (const campo of ["subject", "header", "body", "footer"]) {
    await assert.rejects(() => emailService.sendEmail({ to: "a@b.com", ...PARTES, [campo]: undefined }), /exige/);
  }
});

test("buildHtml escapa conteúdo vindo do usuário", () => {
  const html = emailService.buildHtml({ header: "Olá", body: '<script>alert("x")</script>', footer: "<b>x</b>" });

  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!html.includes("<b>"));
});

test("falha no provedor NÃO derruba o cadastro: o e-mail é só registrado em log", async () => {
  configurar();
  process.env.NOTIFICATIONS_ENABLED = "true";
  process.env.LOG_LEVEL = "silent";
  globalThis.fetch = async () => { throw new Error("rede fora do ar"); };

  const notifications = require("../src/modules/notifications/notification.service");

  let resultado;
  assert.doesNotThrow(() => {
    resultado = notifications.notifyRestaurantCreated({
      restaurant: { id: 1, name: "Taco Loco", category: "Mexicana" },
      owner: { id: 1, name: "Ana", email: "ana@x.com" }
    });
  });

  assert.ok(resultado.some((item) => item.action === "email.boas-vindas" && item.async === true));
  await new Promise((resolve) => setImmediate(resolve));
  process.env.NOTIFICATIONS_ENABLED = "false";
});
