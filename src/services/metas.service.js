const { findMetasByUserUuid } = require("../repositories/metas.repository");
const { createMeta } = require("../repositories/metas.repository");

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
    // Mantiene compatibilidad con clientes que ya consumen titulo.
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

module.exports = {
  getMetasByUser,
  addMeta,
};