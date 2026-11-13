// Foto de perfil (ideia do repositório do João): POST /auth/me/image reaproveita
// o image.service com a pasta "profiles" (ADR-007).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const sharp = require("sharp");

const { startTestServer, createClient } = require("./helpers/server");

const UPLOADS = fs.mkdtempSync(path.join(os.tmpdir(), "easyfood-profiles-"));

let server;
let request;
let token;

test.before(async () => {
  server = await startTestServer({ env: { UPLOADS_DIR: UPLOADS } });
  request = createClient(server.baseUrl);
});

test.after(async () => {
  await server.close();
  fs.rmSync(UPLOADS, { recursive: true, force: true });
});

test.beforeEach(async () => {
  server.prisma.__reset();
  const conta = { name: "Ana", email: "ana@teste.com", password: "senha123" };
  await request("/auth/register", { method: "POST", body: conta });
  const login = await request("/auth/login", { method: "POST", body: { email: conta.email, password: conta.password } });
  token = login.body.token;
});

async function foto(width = 1200, height = 900) {
  return sharp({ create: { width, height, channels: 3, background: "#c33" } }).png().toBuffer();
}

async function enviar(buffer, { auth = token, type = "image/png" } = {}) {
  const form = new FormData();
  if (buffer) form.append("image", new Blob([buffer], { type }), "foto.png");
  const response = await fetch(`${server.baseUrl}/auth/me/image`, {
    method: "POST",
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    body: form
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

test("o perfil nasce sem foto e o login devolve imageUrl nulo", async () => {
  const me = await request("/auth/me", { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.imageUrl, null);
  assert.equal(me.body.user.email, "ana@teste.com");
});

test("POST /auth/me/image exige autenticação", async () => {
  assert.equal((await enviar(await foto(), { auth: null })).status, 401);
});

test("envia a foto: vira WebP de até 800 px em uploads/profiles e aparece no /auth/me", async () => {
  const r = await enviar(await foto());

  assert.equal(r.status, 200);
  assert.match(r.body.imageUrl, /^\/uploads\/profiles\/[0-9a-f-]{36}\.webp$/);
  assert.equal(r.body.password, undefined);

  const arquivo = path.join(UPLOADS, "profiles", path.basename(r.body.imageUrl));
  const meta = await sharp(arquivo).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 800);

  const me = await request("/auth/me", { token });
  assert.equal(me.body.user.imageUrl, r.body.imageUrl);

  // Confirma que o caminho persistido também é servido publicamente por HTTP.
  const imagemHttp = await fetch(`${server.baseUrl}${me.body.user.imageUrl}`);
  assert.equal(imagemHttp.status, 200);
  assert.match(imagemHttp.headers.get("content-type") || "", /^image\/webp(?:;|$)/);
  const imagemRecebida = Buffer.from(await imagemHttp.arrayBuffer());
  assert.ok(imagemRecebida.length > 0);
  assert.equal((await sharp(imagemRecebida).metadata()).format, "webp");
});

test("trocar a foto remove o arquivo antigo", async () => {
  const primeira = await enviar(await foto());
  const segunda = await enviar(await foto(700, 500));

  assert.ok(!fs.existsSync(path.join(UPLOADS, "profiles", path.basename(primeira.body.imageUrl))));
  assert.ok(fs.existsSync(path.join(UPLOADS, "profiles", path.basename(segunda.body.imageUrl))));
});

test("sem arquivo = 400; arquivo que não é imagem = 400; tipo não suportado = 415", async () => {
  assert.equal((await enviar(null)).status, 400);
  assert.equal((await enviar(Buffer.from("isto não é uma imagem"))).status, 400);
  assert.equal((await enviar(Buffer.from("texto"), { type: "text/plain" })).status, 415);
});
