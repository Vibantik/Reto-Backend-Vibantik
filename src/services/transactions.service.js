const categorize = require("./transactions_categorization.service");
const pool = require("../connect");

const getAllTransactions = async (query) => {
  const {
    page = 1,
    limit = 15,
    type,
    category,
    search,
    startDate,
    endDate,
  } = query;

  const values = [];
  const conditions = [];
  let index = 1;

  if (type && type !== "all") {
    conditions.push(`type = $${index++}`);
    values.push(type);
  }

  if (category && category !== "all") {
    conditions.push(`category = $${index++}`);
    values.push(category);
  }

  if (search) {
    conditions.push(`LOWER(description) LIKE LOWER($${index++})`);
    values.push(`%${search}%`);
  }

  if (startDate) {
    conditions.push(`date >= $${index++}`);
    values.push(startDate);
  }

  if (endDate) {
    conditions.push(`date <= $${index++}`);
    values.push(endDate);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const currentPage = Number(page);
  const perPage = Number(limit);
  const offset = (currentPage - 1) * perPage;

  const dataQuery = `
    SELECT "id_transacción" AS id, date, description, category, type, amount
    FROM transacciones
    ${whereClause}
    ORDER BY date DESC, "id_transacción" DESC
    LIMIT $${index++} OFFSET $${index++}
  `;

  values.push(perPage, offset);

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM transacciones
    ${whereClause}
  `;

  const countValues = values.slice(0, values.length - 2);

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, values),
    pool.query(countQuery, countValues),
  ]);

  const totalItems = Number(countResult.rows[0].total);
  const totalPages = Math.ceil(totalItems / perPage);

  /* TRANSACTION CATEGORIZATION */
  const nonCategorized = dataResult.rows.some((t) => !t.category);
  if (nonCategorized) {
    for (let i = 0; i < dataResult.rows.length; i++) {
      if (!dataResult.rows[i].category) {
        const category = await categorize(dataResult.rows[i]);
        await pool.query(
          `UPDATE transacciones SET category = $1 WHERE "id_transacción" = $2`,
          [category, dataResult.rows[i].id]
        );
        dataResult.rows[i].category = category;
      }
    }
  }

  return {
    data: dataResult.rows,
    pagination: {
      page: currentPage,
      limit: perPage,
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
};

const getTransactionById = async (id) => {
  const result = await pool.query(
    `
    SELECT "id_transacción" AS id, date, description, category, type, amount
    FROM transacciones
    WHERE "id_transacción" = $1
    `,
    [id]
  );

  const transaction = result.rows[0];
  if (!transaction) return null;

  if (!transaction.category) {
    const category = await categorize(transaction);
    await pool.query(
      `UPDATE transacciones SET category = $1 WHERE "id_transacción" = $2`,
      [category, transaction.id]
    );
    transaction.category = category;
  }

  return transaction;
};

module.exports = {
  getAllTransactions,
  getTransactionById,
};