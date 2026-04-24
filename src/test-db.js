require("dotenv").config();
const pool = require("./connect");

async function test() {
  try {
    const result = await pool.query("SELECT * FROM transactions LIMIT 5");
    console.log(result.rows);
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit();
  }
}

test();