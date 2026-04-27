const pool = require("../connect");

async function findMetasByUserUuid(uuid) {
  const query = `
    SELECT
      m.id_meta,
      m."nombreMeta" AS nombre_meta,
      m.monto_meta,
      m.fecha_inicio,
      m.fecha_fin,
      m.plazo_dias,
      COALESCE(SUM(a.cantidad), 0) AS ahorro_actual
    FROM meta m
    LEFT JOIN ahorro a ON a.id_meta = m.id_meta
    WHERE m.uuid_de_usuario = $1
    GROUP BY m.id_meta, m."nombreMeta", m.monto_meta, m.fecha_inicio, m.fecha_fin, m.plazo_dias
    ORDER BY m.fecha_inicio DESC;
  `;

  const { rows } = await pool.query(query, [uuid]);
  return rows;
}

async function createMeta({
  uuidDeUsuario,
  nombreMeta,
  montoMeta,
  fechaInicio,
  fechaFin,
  plazoDias,
}) {
  const query = `
    INSERT INTO meta (plazo_dias, fecha_inicio, fecha_fin, monto_meta, uuid_de_usuario, "nombreMeta")
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id_meta, "nombreMeta" AS nombre_meta, plazo_dias, fecha_inicio, fecha_fin, monto_meta, uuid_de_usuario;
  `;
  const values = [plazoDias, fechaInicio, fechaFin, montoMeta, uuidDeUsuario, nombreMeta];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

module.exports = {
  findMetasByUserUuid,
  createMeta
};