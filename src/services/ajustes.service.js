const pool = require("../connect");

const getUserSettings = async (id) => {
  const result = await pool.query(
    `
    SELECT * FROM preferencia WHERE uuid_de_usuario = $1
    `,
    [id]
  );

  return result.rows[0] || null;
};

const updateAjuste = async (ajuste) => {
  const {
    uuid_de_usuario,
    activ_presupuestos,
    activ_reportes,
    activ_ia,
    activ_alertas,
    activ_metas,
    activ_categ,
  } = ajuste;

  const query = `
    UPDATE Preferencia
    SET activ_presupuestos = $1,
        activ_reportes = $2,
        activ_ia = $3,
        activ_alertas = $4,
        activ_metas = $5,
        activ_categ = $6
    WHERE uuid_de_usuario = $7
    RETURNING *;
  `;

  const values = [
    activ_presupuestos,
    activ_reportes,
    activ_ia,
    activ_alertas,
    activ_metas,
    activ_categ,
    uuid_de_usuario,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

module.exports = {
  getUserSettings,
  updateAjuste
};