const pool = require("../connect");

const getAllInversiones = async () => {
  const result = await pool.query(`
    SELECT
      i."id_inversión",
      i.nombre,
      i.valor,
      i.fecha_inicio,
      i.fecha_fin,
      t.nombre AS tipo
    FROM inversiones i
    LEFT JOIN tipo_inversiones t ON i.id_tipo = t."id_tipo_inversión"
    ORDER BY i.fecha_fin ASC
  `);
  return result.rows;
};

const getInversionesByUser = async (uuid) => {
  const result = await pool.query(`
    SELECT
      i."id_inversión",
      i.nombre,
      i.valor,
      i.fecha_inicio,
      i.fecha_fin,
      t.nombre AS tipo
    FROM inversiones i
    LEFT JOIN tipo_inversiones t ON i.id_tipo = t."id_tipo_inversión"
    WHERE i.uuid_de_usuario = $1
    ORDER BY i.fecha_fin ASC
  `, [uuid]);
  return result.rows;
};

const getInversionById = async (id) => {
  const result = await pool.query(
    `
    SELECT
      i."id_inversión",
      i.nombre,
      i.valor,
      i.fecha_inicio,
      i.fecha_fin,
      t.nombre AS tipo
    FROM inversiones i
    LEFT JOIN tipo_inversiones t ON i.id_tipo = t."id_tipo_inversión"
    WHERE i."id_inversión" = $1
    `,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = { getAllInversiones, getInversionesByUser, getInversionById };