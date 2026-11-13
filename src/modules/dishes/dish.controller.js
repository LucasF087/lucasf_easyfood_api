
// Camada Controller
// Responsabilidade: receber a requisição, validar a entrada, chamar o Service
// e devolver a resposta. Sem try/catch: o Express 5 encaminha erros de handlers
// async para o error handler central, que responde sempre em JSON.

const dishService = require("./dish.service");
const { validateDish, validateId } = require("../../shared/validators");
const { badRequest } = require("../../shared/http-error");

// Padroniza os preços para duas casas decimais no JSON.
function formatDish(dish) {
  return {
    ...dish,
    price: Number(dish.price).toFixed(2)
  };
}

function parseId(value, label) {
  const errors = [];
  const result = validateId(value, errors, label);

  if (errors.length > 0) {
    throw badRequest("Dados inválidos", errors);
  }

  return result.value;
}

async function create(req, res) {
  const restaurantId = parseId(req.params.restaurantId, "restaurantId");
  const { data, errors } = validateDish(req.body ?? {});

  if (errors.length > 0) {
    throw badRequest("Dados inválidos", errors);
  }

  const dish = await dishService.createDish(restaurantId, data, req.user);

  res.status(201).json(formatDish(dish));
}

async function list(req, res) {
  const restaurantId = parseId(req.params.restaurantId, "restaurantId");
  const dishes = await dishService.listDishes(restaurantId);

  res.json(dishes.map(formatDish));
}

async function show(req, res) {
  const dishId = parseId(req.params.dishId, "dishId");

  res.json(formatDish(await dishService.getDish(dishId)));
}

async function update(req, res) {
  const dishId = parseId(req.params.dishId, "dishId");
  const { data, errors } = validateDish(req.body ?? {});

  if (errors.length > 0) {
    throw badRequest("Dados inválidos", errors);
  }

  const dish = await dishService.updateDish(dishId, data, req.user);

  res.json(formatDish(dish));
}

async function remove(req, res) {
  const dishId = parseId(req.params.dishId, "dishId");

  await dishService.deleteDish(dishId, req.user);

  res.status(204).end();
}

async function uploadImage(req, res) {
  const dishId = parseId(req.params.dishId, "dishId");

  const result = await dishService.updateDishImage(dishId, req.file, req.user);

  res.json(formatDish(result));
}

module.exports = { create, list, show, update, remove, uploadImage };
