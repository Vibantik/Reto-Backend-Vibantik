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

module.exports = {
  getUserSettings
};