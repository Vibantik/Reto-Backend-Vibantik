const pool = require("../connect");

const getAllCategorias = async () => {
  const result = await pool.query(`
    SELECT id_categ, nombre_categ, icon, color
    FROM categoria
    ORDER BY id_categ ASC
  `);
  return result.rows;
};

const getCategoriaById = async (id) => {
  const result = await pool.query(
    `SELECT id_categ, nombre_categ, icon, color
     FROM categoria
     WHERE id_categ = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const createCategoria = async ({ nombre_categ, icon = "zap", color = "#7B868C" }) => {
  const result = await pool.query(
    `INSERT INTO categoria (nombre_categ, icon, color)
     VALUES ($1, $2, $3)
     RETURNING id_categ, nombre_categ, icon, color`,
    [nombre_categ, icon, color]
  );
  return result.rows[0];
};

const updateCategoria = async (id, { nombre_categ, icon, color }) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (nombre_categ !== undefined) {
    fields.push(`nombre_categ = $${idx++}`);
    values.push(nombre_categ);
  }
  if (icon !== undefined) {
    fields.push(`icon = $${idx++}`);
    values.push(icon);
  }
  if (color !== undefined) {
    fields.push(`color = $${idx++}`);
    values.push(color);
  }

  if (fields.length === 0) return getCategoriaById(id);

  values.push(id);
  const result = await pool.query(
    `UPDATE categoria SET ${fields.join(", ")}
     WHERE id_categ = $${idx}
     RETURNING id_categ, nombre_categ, icon, color`,
    values
  );
  return result.rows[0] || null;
};

const deleteCategoria = async (id) => {
  const result = await pool.query(
    `DELETE FROM categoria WHERE id_categ = $1 RETURNING id_categ`,
    [id]
  );
  return result.rowCount > 0;
};

module.exports = {
  getAllCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  deleteCategoria,
};
