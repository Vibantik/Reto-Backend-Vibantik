const pool = require("../connect");

async function findMetasByUserUuid(uuid) {
  const query = `
    SELECT
      m.id_meta,
      m.monto_meta,
      m.fecha_inicio,
      m.fecha_fin,
      m.plazo_dias,
      COALESCE(SUM(a.cantidad), 0) AS ahorro_actual
    FROM meta m
    LEFT JOIN ahorro a ON a.id_meta = m.id_meta
    WHERE m.uuid_de_usuario = $1
    GROUP BY m.id_meta, m.monto_meta, m.fecha_inicio, m.fecha_fin, m.plazo_dias
    ORDER BY m.fecha_inicio DESC;
  `;

  const { rows } = await pool.query(query, [uuid]);
  return rows;
}

module.exports = {
  findMetasByUserUuid,
};