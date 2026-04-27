const { findMetasByUserUuid } = require("../repositories/metas.repository");

async function getMetasByUser(uuid) {
  const rows = await findMetasByUserUuid(uuid);

  return rows.map((r) => {
    const monto = Number(r.monto_meta || 0);
    const ahorroActual = Number(r.ahorro_actual || 0);
    const progreso = monto > 0 ? Math.min(ahorroActual / monto, 1) : 0;

    return {
      id_meta: r.id_meta,
      monto_meta: monto,
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      plazo_dias: r.plazo_dias,
      titulo: `Meta ${r.id_meta}`,
      progreso,
    };
  });
}

module.exports = {
  getMetasByUser,
};