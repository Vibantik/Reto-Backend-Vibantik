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
    SELECT id, date, description, category, type, amount
    FROM transactions
    ${whereClause}
    ORDER BY date DESC, id DESC
    LIMIT $${index++} OFFSET $${index++}
  `;

  values.push(perPage, offset);

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM transactions
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
  const nonCategorized = dataResult.rows.some((transaction) => !transaction.category);
  if (nonCategorized) {
    for (let i = 0; i < dataResult.rows.length; i++) {
      if (!dataResult.rows[i].category) {
        // TODO: Check first in DB
        const category = await categorize(dataResult.rows[i]);
        // TODO: Update in DB
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
    SELECT id, date, description, category, type, amount
    FROM transactions
    WHERE id = $1
    `,
    [id]
  );

  if (!result.rows[0].category) {
    const category = await categorize(result.rows[0]);
    // TODO: Update in DB
    result.rows[0].category = category;
  }
  return result.rows[0] || null;
};

module.exports = {
  getAllTransactions,
  getTransactionById,
};