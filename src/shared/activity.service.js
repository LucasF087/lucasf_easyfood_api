// Camada Shared
// Responsabilidade: registrar atividades do sistema NO BANCO (tabela Activity),
// em vez de só escrever uma linha de log. Modelo inspirado no repositório do
// professor (activity.service.js com action + details).
//
// Regra: registrar atividade é secundário. Uma falha aqui nunca pode derrubar
// a operação principal (que já foi gravada), então log() captura o erro e só o
// registra no log do servidor.

const prisma = require("../database/prisma");
const logger = require("./logger");

const ACTION_MAX = 100;

// `details` aceita texto ou objeto simples (vira JSON). Nunca coloque senha,
// token ou e-mail de terceiros aqui: a tabela é uma trilha de auditoria.
function serialize(details) {
  if (details === undefined || details === null) return null;
  return typeof details === "string" ? details : JSON.stringify(details);
}

async function log(action, details) {
  try {
    return await prisma.activity.create({
      data: {
        action: String(action).slice(0, ACTION_MAX),
        details: serialize(details)
      }
    });
  } catch (error) {
    logger.error("Falha ao registrar atividade", { acao: action, motivo: error?.message });
    return null;
  }
}

module.exports = { log };
