// Cardápio e imagens (atividade 7): cadastro de pratos, posse do restaurante,
// upload com otimização (sharp), limites do multer e falhas esperadas.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const sharp = require("sharp");

const { startTestServer, createClient } = require("./helpers/server");

const UPLOADS = fs.mkdtempSync(path.join(os.tmpdir(), "easyfood-uploads-"));

let server;
let request;

test.before(async () => {
  server = await startTestServer({ env: { UPLOADS_DIR: UPLOADS } });
  request = createClient(server.baseUrl);
});

test.after(async () => {
  await server.close();
  fs.rmSync(UPLOADS, { recursive: true, force: true });
});

async function logar(email) {
  const conta = { name: "Dono", email, password: "senha123" };
  await request("/auth/register", { method: "POST", body: conta });
  const login = await request("/auth/login", { method: "POST", body: { email, password: conta.password } });
  return { token: login.body.token, id: login.body.user.id };
}

// Imagem grande e com ruído (não comprime trivialmente) gerada na hora.
async function imagemGrande(width = 2000, height = 1500) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 256;
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

// O helper createClient serializa JSON; para multipart usamos fetch direto.
async function upload(token, dishId, buffer, opts = {}) {
  const { type = "image/png", name = "prato.png", field = "image" } = opts;
  const form = new FormData();
  if (buffer) form.append(field, new Blob([buffer], { type }), name);
  const response = await fetch(`${server.baseUrl}/dishes/${dishId}/image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

let dono;
let intruso;

test.beforeEach(async () => {
  fs.rmSync(path.join(UPLOADS, "dishes"), { recursive: true, force: true });
  server.prisma.__reset();
  dono = await logar("dono@teste.com");
  intruso = await logar("intruso@teste.com");
  server.prisma.__seed({ restaurants: [{ name: "Pizzaria Napoli", category: "Pizza", rating: 4.5, userId: dono.id }] });
});

const PRATO = { name: "Pizza Margherita", description: "Molho de tomate, queijo e manjericão", price: 49.9 };

test("POST /restaurants/:id/dishes cadastra o prato (201) e o GET lista", async () => {
  const criado = await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });

  assert.equal(criado.status, 201);
  assert.equal(criado.body.price, "49.90");
  assert.equal(criado.body.imageUrl, null);
  assert.equal(criado.body.restaurantId, 1);

  const lista = await request("/restaurants/1/dishes");
  assert.equal(lista.status, 200);
  assert.equal(lista.body.length, 1);
});

test("cadastrar prato exige autenticação e ser o dono do restaurante", async () => {
  assert.equal((await request("/restaurants/1/dishes", { method: "POST", body: PRATO })).status, 401);
  assert.equal((await request("/restaurants/1/dishes", { method: "POST", token: intruso.token, body: PRATO })).status, 403);
  assert.equal((await request("/restaurants/99/dishes", { method: "POST", token: dono.token, body: PRATO })).status, 404);
});

test("validação do prato: nome, descrição e preço", async () => {
  for (const body of [
    { ...PRATO, name: "" },
    { ...PRATO, description: undefined },
    { ...PRATO, price: -1 },
    { ...PRATO, price: "abc" },
    { ...PRATO, price: 0 }
  ]) {
    const r = await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }

  const virgula = await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: { ...PRATO, price: "49,90" } });
  assert.equal(virgula.status, 201);
});

test("GET do cardápio: id inválido é 400 e restaurante inexistente é 404", async () => {
  assert.equal((await request("/restaurants/abc/dishes")).status, 400);
  assert.equal((await request("/restaurants/99/dishes")).status, 404);
});

test("upload reduz para até 800 px, converte para WebP e grava o caminho no prato", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  const original = await imagemGrande();

  const r = await upload(dono.token, 1, original);

  assert.equal(r.status, 200);
  assert.match(r.body.imageUrl, /^\/uploads\/dishes\/[0-9a-f-]{36}\.webp$/);
  assert.ok(r.body.image.optimizedBytes < r.body.image.originalBytes);

  const arquivo = path.join(UPLOADS, "dishes", path.basename(r.body.imageUrl));
  const meta = await sharp(arquivo).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 800);

  // a imagem otimizada é servida publicamente
  const servida = await fetch(`${server.baseUrl}${r.body.imageUrl}`);
  assert.equal(servida.status, 200);
  assert.equal(servida.headers.get("content-type"), "image/webp");
});

test("imagem pequena não é ampliada", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  const r = await upload(dono.token, 1, await imagemGrande(300, 200));

  const meta = await sharp(path.join(UPLOADS, "dishes", path.basename(r.body.imageUrl))).metadata();
  assert.equal(meta.width, 300);
});

test("trocar a imagem remove o arquivo antigo", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  const primeira = await upload(dono.token, 1, await imagemGrande(900, 600));
  const segunda = await upload(dono.token, 1, await imagemGrande(900, 600));

  assert.ok(!fs.existsSync(path.join(UPLOADS, "dishes", path.basename(primeira.body.imageUrl))));
  assert.ok(fs.existsSync(path.join(UPLOADS, "dishes", path.basename(segunda.body.imageUrl))));
});

test("falhas do upload: sem token, sem arquivo, não-imagem, grande demais, dono errado", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  const png = await imagemGrande(400, 300);

  assert.equal((await upload(undefined, 1, png)).status, 401);
  assert.equal((await upload(intruso.token, 1, png)).status, 403);
  assert.equal((await upload(dono.token, 99, png)).status, 404);
  assert.equal((await upload(dono.token, 1, undefined)).status, 400);

  // tipo não permitido
  assert.equal((await upload(dono.token, 1, Buffer.from("texto"), { type: "text/plain", name: "a.txt" })).status, 415);
  // diz ser PNG, mas o conteúdo não é imagem
  assert.equal((await upload(dono.token, 1, Buffer.from("não sou imagem"), { type: "image/png" })).status, 400);
  // acima de 5 MB
  const grande = Buffer.alloc(5 * 1024 * 1024 + 10, 1);
  assert.equal((await upload(dono.token, 1, grande, { type: "image/png" })).status, 413);
  // campo com nome errado
  assert.equal((await upload(dono.token, 1, png, { field: "foto" })).status, 400);

  // nada foi gravado em nenhuma dessas falhas
  const pasta = path.join(UPLOADS, "dishes");
  assert.equal(fs.existsSync(pasta) ? fs.readdirSync(pasta).length : 0, 0);
});

test("falha no upload NÃO apaga o prato: ele segue cadastrado e aceita nova tentativa", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });

  // Tentativas que falham: não-imagem disfarçada de PNG e arquivo acima do limite.
  assert.equal((await upload(dono.token, 1, Buffer.from("não sou imagem"), { type: "image/png" })).status, 400);
  assert.equal((await upload(dono.token, 1, Buffer.alloc(5 * 1024 * 1024 + 10, 1), { type: "image/png" })).status, 413);

  // O prato continua lá, sem imagem.
  const cardapio = await request("/restaurants/1/dishes");
  assert.equal(cardapio.status, 200);
  assert.equal(cardapio.body.length, 1);
  assert.equal(cardapio.body[0].imageUrl, null);

  // E uma nova tentativa, agora com imagem válida, funciona.
  const retry = await upload(dono.token, 1, await imagemGrande(400, 300));
  assert.equal(retry.status, 200);
  assert.match(retry.body.imageUrl, /^\/uploads\/dishes\/[0-9a-f-]{36}\.webp$/);
});

test("a imagem otimizada abre pelo navegador em GET /uploads/dishes/<arquivo>.webp", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  const enviado = await upload(dono.token, 1, await imagemGrande(2000, 1500));
  assert.equal(enviado.status, 200);

  const resposta = await fetch(`${server.baseUrl}${enviado.body.imageUrl}`);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get("content-type"), "image/webp");

  const meta = await sharp(Buffer.from(await resposta.arrayBuffer())).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 800);
});

test("excluir o restaurante remove o cardápio (cascade)", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  await request("/restaurants/1", { method: "DELETE", token: dono.token });

  assert.equal(server.prisma.__state.dishes.length, 0);
});

test("multipart continua proibido nas demais rotas (415)", async () => {
  const form = new FormData();
  form.append("name", "x");
  const r = await fetch(`${server.baseUrl}/restaurants`, {
    method: "POST",
    headers: { Authorization: `Bearer ${dono.token}` },
    body: form
  });
  assert.equal(r.status, 415);
});

// ---- CRUD completo do prato (referência de correção do professor) ----------

test("GET /dishes/:id é público; 404 se não existe; 400 se o id é inválido", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });

  const ok = await request("/dishes/1");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, "Pizza Margherita");

  assert.equal((await request("/dishes/99")).status, 404);
  assert.equal((await request("/dishes/abc")).status, 400);
});

test("PUT /dishes/:id atualiza o prato; só o dono; mantém a imagem", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  await upload(dono.token, 1, await imagemGrande(900, 600));

  const novo = { name: "Pizza Calabresa", description: "Calabresa e cebola", price: 54.5 };

  assert.equal((await request("/dishes/1", { method: "PUT", body: novo })).status, 401);
  assert.equal((await request("/dishes/1", { method: "PUT", token: intruso.token, body: novo })).status, 403);
  assert.equal((await request("/dishes/1", { method: "PUT", token: dono.token, body: { ...novo, price: -5 } })).status, 400);
  assert.equal((await request("/dishes/99", { method: "PUT", token: dono.token, body: novo })).status, 404);

  const r = await request("/dishes/1", { method: "PUT", token: dono.token, body: novo });
  assert.equal(r.status, 200);
  assert.equal(r.body.name, "Pizza Calabresa");
  assert.equal(r.body.price, "54.50");
  assert.match(r.body.imageUrl, /^\/uploads\/dishes\//);
});

test("DELETE /dishes/:id exclui o prato e apaga a imagem do disco; só o dono", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  const enviado = await upload(dono.token, 1, await imagemGrande(900, 600));
  const arquivo = path.join(UPLOADS, "dishes", path.basename(enviado.body.imageUrl));
  assert.ok(fs.existsSync(arquivo));

  assert.equal((await request("/dishes/1", { method: "DELETE" })).status, 401);
  assert.equal((await request("/dishes/1", { method: "DELETE", token: intruso.token })).status, 403);
  assert.equal((await request("/dishes/99", { method: "DELETE", token: dono.token })).status, 404);

  assert.equal((await request("/dishes/1", { method: "DELETE", token: dono.token })).status, 204);
  assert.equal((await request("/dishes/1")).status, 404);
  assert.ok(!fs.existsSync(arquivo));
});

test("o upload devolve o prato direto (com imageUrl) e os tamanhos no campo extra image", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  const r = await upload(dono.token, 1, await imagemGrande(900, 600));

  assert.equal(r.status, 200);
  assert.equal(r.body.id, 1);
  assert.equal(r.body.name, "Pizza Margherita");
  assert.equal(typeof r.body.image.originalBytes, "number");
  assert.equal(r.body.dish, undefined);
});

test("imagem acima de 25 megapixels é recusada (blindagem do Sharp)", async () => {
  await request("/restaurants/1/dishes", { method: "POST", token: dono.token, body: PRATO });
  // 6000 x 5000 = 30 MP, mas um PNG de cor única pesa poucos KB.
  const gigante = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: "#fff" } }).png().toBuffer();
  assert.ok(gigante.length < 5 * 1024 * 1024);

  const r = await upload(dono.token, 1, gigante);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /25 megapixels/);
});
