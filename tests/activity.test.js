// Atividade persistida: activity.service grava action + details em Activity.

const test = require("node:test");
const assert = require("node:assert/strict");

const { installPrismaStub } = require("./helpers/prisma-stub");

const prisma = installPrismaStub();
const activity = require("../src/shared/activity.service");

process.env.LOG_LEVEL = "silent";

test.beforeEach(() => prisma.__reset());

test("log() grava action, details (texto) e createdAt", async () => {
  const r = await activity.log("restaurant.created", "Taco Loco");

  assert.equal(r.action, "restaurant.created");
  assert.equal(r.details, "Taco Loco");
  assert.ok(r.createdAt instanceof Date);
  assert.equal(prisma.__state.activities.length, 1);
});

test("details como objeto vira JSON; sem details fica nulo", async () => {
  await activity.log("a", { restaurantId: 1 });
  await activity.log("b");

  assert.equal(prisma.__state.activities[0].details, '{"restaurantId":1}');
  assert.equal(prisma.__state.activities[1].details, null);
});

test("action é cortada em 100 caracteres (coluna VarChar(100))", async () => {
  await activity.log("x".repeat(300));
  assert.equal(prisma.__state.activities[0].action.length, 100);
});

test("falha do banco não lança: devolve null", async () => {
  prisma.__failNextWith(new Error("banco fora do ar"));
  assert.equal(await activity.log("a", "b"), null);
});
