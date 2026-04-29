const { findMetasByUserUuid } = require("../repositories/metas.repository");
const { createMeta } = require("../repositories/metas.repository");
const { updateMetaByIdAndUser } = require("../repositories/metas.repository");
const { deleteMetaByIdAndUser } = require("../repositories/metas.repository");

function normalizeMeta(row) {
  const montoMeta = Number(row.monto_meta || 0);
  const ahorroActual = Number(row.ahorro_actual || 0);
  const progreso = montoMeta > 0 ? Math.min(ahorroActual / montoMeta, 1) : 0;
  const nombreMeta = row.nombre_meta || row.nombreMeta || "";

  return {
    id_meta: row.id_meta,
    nombreMeta,
    monto_meta: montoMeta,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    plazo_dias: Number(row.plazo_dias || 0),
    titulo: nombreMeta || `Meta ${row.id_meta}`,
    progreso,
  };
}

async function getMetasByUser(uuid) {
  const rows = await findMetasByUserUuid(uuid);
  return rows.map(normalizeMeta);
}

async function addMeta(input) {
  const row = await createMeta(input);
  return normalizeMeta(row);
}

async function updateMetaById(input) {
  const row = await updateMetaByIdAndUser(input);
  if (!row) return null;
  return normalizeMeta(row);
}

async function deleteMetaById(input) {
  return deleteMetaByIdAndUser(input);
}

module.exports = {
  getMetasByUser,
  addMeta,
  updateMetaById,
  deleteMetaById,
};