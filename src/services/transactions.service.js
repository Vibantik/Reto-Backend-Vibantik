const transactions = require("../data/transactions.mock");

const getAllTransactions = (query) => {
  const {
    page = 1,
    limit = 15,
    type,
    category,
    search,
    startDate,
    endDate,
  } = query;

  let results = [...transactions];

  if (type && type !== "all") {
    results = results.filter((tx) => tx.type === type);
  }

  if (category && category !== "all") {
    results = results.filter((tx) => tx.category === category);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    results = results.filter(
      (tx) =>
        tx.description.toLowerCase().includes(searchLower) ||
        tx.amount.toString().includes(searchLower)
    );
  }

  if (startDate) {
    results = results.filter((tx) => new Date(tx.date) >= new Date(startDate));
  }

  if (endDate) {
    results = results.filter((tx) => new Date(tx.date) <= new Date(endDate));
  }

  results.sort((a, b) => new Date(b.date) - new Date(a.date));

  const currentPage = Number(page);
  const perPage = Number(limit);
  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / perPage);

  const startIndex = (currentPage - 1) * perPage;
  const endIndex = startIndex + perPage;

  const paginatedData = results.slice(startIndex, endIndex);

  return {
    data: paginatedData,
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

const getTransactionById = (id) => {
  return transactions.find((tx) => tx.id === Number(id));
};

module.exports = {
  getAllTransactions,
  getTransactionById,
};