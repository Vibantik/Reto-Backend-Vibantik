const pool = require("../connect");

// Listar presupuestos del usuario
// !Opcional: filtrar solo los activos (donde now() está entre inicio y fin)
const getAllPresupuestos = async (uuid, { soloActivos = false } = {}) => {
  let query = `
    SELECT p.id_presupuesto, p.nombre, p.monto_limite, p."descripción",
           p.inicio, p.fin, p.updated_at,
           COALESCE(
             (SELECT SUM(t.amount)
              FROM relacion_pt rp
              JOIN transacciones t ON t."id_transacción" = rp."id_transacción"
              WHERE rp.id_presupuesto = p.id_presupuesto AND t.type = 'egreso'),
           0) AS total_ejecutado,
           COALESCE(
             (SELECT SUM(t.amount)
              FROM relacion_pt rp
              JOIN transacciones t ON t."id_transacción" = rp."id_transacción"
              WHERE rp.id_presupuesto = p.id_presupuesto AND t.type = 'ingreso'),
           0) AS total_ingresos
    FROM presupuesto p
    WHERE p.uuid_de_usuario = $1
  `;

  if (soloActivos) {
    query += ` AND p.inicio <= NOW() AND (p.fin IS NULL OR p.fin >= NOW())`;
  }

  query += ` ORDER BY p.inicio DESC`;

  const result = await pool.query(query, [uuid]);
  return result.rows;
};

const getLatestPresupuesto = async (uuid) => {
  const result = await pool.query(
    `
      SELECT id_presupuesto
      FROM presupuesto
      WHERE uuid_de_usuario = $1
      ORDER BY inicio DESC, updated_at DESC
      LIMIT 1
    `,
    [uuid]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return getPresupuestoById(result.rows[0].id_presupuesto);
};

//Detalle de un presupuesto con sus categorías asignadas y transacciones vinculadas
const getPresupuestoById = async (id) => {
  // Presupuesto base
  const presResult = await pool.query(
    `SELECT id_presupuesto, uuid_de_usuario, nombre, monto_limite, "descripción",
            inicio, fin, updated_at
     FROM presupuesto
     WHERE id_presupuesto = $1`,
    [id]
  );
  if (presResult.rows.length === 0) return null;

  const presupuesto = presResult.rows[0];

  // Categorías asignadas con sus montos
  const catResult = await pool.query(
    `SELECT rpc.id_relacion_presupuesto_categoria, rpc.id_categ, rpc.monto_asignado,
            c.nombre_categ, c.icon, c.color
     FROM relacion_presupuesto_categoria rpc
     JOIN categoria c ON c.id_categ = rpc.id_categ
     WHERE rpc.id_presupuesto = $1
     ORDER BY rpc.id_relacion_presupuesto_categoria ASC`,
    [id]
  );
  presupuesto.categorias = catResult.rows;

  // Transacciones vinculadas
  const txnResult = await pool.query(
    `SELECT t."id_transacción" AS id, t.date, t.description, t.category,
            t.type, t.amount
     FROM relacion_pt rp
     JOIN transacciones t ON t."id_transacción" = rp."id_transacción"
     WHERE rp.id_presupuesto = $1
     ORDER BY t.date DESC`,
    [id]
  );
  presupuesto.transacciones = txnResult.rows;

  return presupuesto;
};

// Crear presupuesto con categorías asignadas
//? body: { nombre, monto_limite, descripción, inicio, fin, categorias: [{id_categ, monto_asignado}] }
const createPresupuesto = async (uuid, data) => {
  const { nombre, monto_limite, descripción = "", inicio, fin, categorias = [] } = data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const presResult = await client.query(
      `INSERT INTO presupuesto (uuid_de_usuario, nombre, monto_limite, "descripción", inicio, fin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_presupuesto, nombre, monto_limite, "descripción", inicio, fin, updated_at`,
      [uuid, nombre, monto_limite, descripción, inicio || new Date(), fin || null]
    );
    const presupuesto = presResult.rows[0];

    // Insertar categorías asignadas
    if (categorias.length > 0) {
      const catValues = categorias
        .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
        .join(", ");
      const catParams = [presupuesto.id_presupuesto];
      categorias.forEach((c) => {
        catParams.push(c.id_categ, c.monto_asignado || 0);
      });

      await client.query(
        `INSERT INTO relacion_presupuesto_categoria (id_presupuesto, id_categ, monto_asignado)
         VALUES ${catValues}`,
        catParams
      );
    }

    await client.query("COMMIT");
    return await getPresupuestoById(presupuesto.id_presupuesto);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

//* Actualizar presupuesto y sus categorías
const updatePresupuesto = async (id, data) => {
  const { nombre, monto_limite, descripción, inicio, fin, categorias } = data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Actualizar campos del presupuesto
    const fields = [];
    const values = [];
    let idx = 1;

    if (nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(nombre); }
    if (monto_limite !== undefined) { fields.push(`monto_limite = $${idx++}`); values.push(monto_limite); }
    if (descripción !== undefined) { fields.push(`"descripción" = $${idx++}`); values.push(descripción); }
    if (inicio !== undefined) { fields.push(`inicio = $${idx++}`); values.push(inicio); }
    if (fin !== undefined) { fields.push(`fin = $${idx++}`); values.push(fin); }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      await client.query(
        `UPDATE presupuesto SET ${fields.join(", ")} WHERE id_presupuesto = $${idx}`,
        values
      );
    }

    // Reemplazar categorías si se proporcionan
    if (categorias !== undefined) {
      await client.query(
        `DELETE FROM relacion_presupuesto_categoria WHERE id_presupuesto = $1`,
        [id]
      );

      if (categorias.length > 0) {
        const catValues = categorias
          .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
          .join(", ");
        const catParams = [id];
        categorias.forEach((c) => {
          catParams.push(c.id_categ, c.monto_asignado || 0);
        });

        await client.query(
          `INSERT INTO relacion_presupuesto_categoria (id_presupuesto, id_categ, monto_asignado)
           VALUES ${catValues}`,
          catParams
        );
      }
    }

    await client.query("COMMIT");
    return await getPresupuestoById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ! Eliminar presupuesto (cascada en relacion_presupuesto_categoria y relacion_pt)
const deletePresupuesto = async (id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM relacion_presupuesto_categoria WHERE id_presupuesto = $1`, [id]);
    await client.query(`DELETE FROM relacion_pt WHERE id_presupuesto = $1`, [id]);
    const result = await client.query(`DELETE FROM presupuesto WHERE id_presupuesto = $1 RETURNING id_presupuesto`, [id]);
    await client.query("COMMIT");
    return result.rowCount > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// * Vincular una transacción a un presupuesto
const vincularTransaccion = async (idPresupuesto, idTransaccion) => {
  const result = await pool.query(
    `INSERT INTO relacion_pt ("id_transacción", id_presupuesto)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id_relacion_pt`,
    [idTransaccion, idPresupuesto]
  );
  return result.rows[0] || null;
};

module.exports = {
  getAllPresupuestos,
  getLatestPresupuesto,
  getPresupuestoById,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
  vincularTransaccion,
};
