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

const createInversion = async ({ uuidDeUsuario, nombre, valor, fechaInicio, fechaFin, idTipo }) => {
  const result = await pool.query(
    `INSERT INTO inversiones (uuid_de_usuario, nombre, valor, fecha_inicio, fecha_fin, id_tipo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING
       "id_inversión",
       nombre,
       valor,
       fecha_inicio,
       fecha_fin,
       id_tipo`,
    [uuidDeUsuario, nombre, valor, fechaInicio, fechaFin, idTipo || null]
  );

  const row = result.rows[0];

  // Obtener el nombre del tipo si existe
  if (row.id_tipo) {
    const tipoResult = await pool.query(
      `SELECT nombre FROM tipo_inversiones WHERE "id_tipo_inversión" = $1`,
      [row.id_tipo]
    );
    row.tipo = tipoResult.rows[0]?.nombre || null;
  } else {
    row.tipo = null;
  }

  return row;
};

module.exports = { getAllInversiones, getInversionesByUser, getInversionById, createInversion };