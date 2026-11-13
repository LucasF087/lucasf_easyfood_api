// Camada Service
// Responsabilidade: regras do cardápio. Não conhece req/res.
//
// Regras:
//   - o restaurante precisa existir (404)
//   - só o DONO do restaurante cadastra prato ou envia imagem (403 caso contrário),
//     reaproveitando a regra de posse do módulo de restaurantes
//   - listar o cardápio e ver um prato são públicos
//   - editar e excluir prato: só o dono (checagem via restaurante do prato)

const prisma = require("../../database/prisma");
const restaurantService = require("../restaurants/restaurant.service");
const imageService = require("../../shared/image.service");
const { notFound, badRequest } = require("../../shared/http-error");

async function createDish(restaurantId, data, user) {
  await restaurantService.getOwnedRestaurant(restaurantId, user);

  return prisma.dish.create({
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      restaurantId
    }
  });
}

async function listDishes(restaurantId) {
  await restaurantService.getRestaurant(restaurantId);

  return prisma.dish.findMany({
    where: { restaurantId },
    orderBy: { id: "asc" }
  });
}

// Carrega o prato e confirma que o usuário é o dono do restaurante dele.
// 404 se o prato não existe; 403 se o restaurante é de outra pessoa.
async function getOwnedDish(dishId, user) {
  const dish = await getDish(dishId);

  await restaurantService.getOwnedRestaurant(dish.restaurantId, user);

  return dish;
}

async function getDish(dishId) {
  const dish = await prisma.dish.findUnique({ where: { id: dishId } });

  if (!dish) {
    throw notFound("Prato não encontrado");
  }

  return dish;
}

async function updateDish(dishId, data, user) {
  await getOwnedDish(dishId, user);

  // imageUrl não muda aqui: só o endpoint de upload grava esse campo.
  return prisma.dish.update({
    where: { id: dishId },
    data: { name: data.name, description: data.description, price: data.price }
  });
}

async function deleteDish(dishId, user) {
  const dish = await getOwnedDish(dishId, user);

  await prisma.dish.delete({ where: { id: dishId } });

  // Depois de excluir o registro, apaga a imagem do disco (best-effort).
  await imageService.removeImage(dish.imageUrl);
}

// 1) localiza o prato  2) confere o dono  3) otimiza e grava a imagem
// 4) atualiza o caminho no banco  5) remove a imagem anterior, se havia.
async function updateDishImage(dishId, file, user) {
  if (!file) {
    throw badRequest("Envie uma imagem no campo \"image\" (multipart/form-data)");
  }

  const dish = await prisma.dish.findUnique({ where: { id: dishId } });

  if (!dish) {
    throw notFound("Prato não encontrado");
  }

  await restaurantService.getOwnedRestaurant(dish.restaurantId, user);

  const saved = await imageService.optimizeAndSave(file.buffer, { folder: "dishes" });

  let updated;

  try {
    updated = await prisma.dish.update({
      where: { id: dishId },
      data: { imageUrl: saved.url }
    });
  } catch (error) {
    // O banco falhou: não deixa a imagem nova órfã em disco.
    await imageService.removeImage(saved.url);
    throw error;
  }

  await imageService.removeImage(dish.imageUrl);

  // Devolve o PRATO direto (como mostra o enunciado), com os tamanhos antes/depois
  // num campo extra "image". Quem lê só dish.imageUrl não percebe diferença.
  return {
    ...updated,
    image: { originalBytes: saved.originalBytes, optimizedBytes: saved.optimizedBytes }
  };
}

module.exports = {
  createDish,
  listDishes,
  getDish,
  updateDish,
  deleteDish,
  updateDishImage
};
