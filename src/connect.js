const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(__dirname, '..', 'ca.pem')).toString(),
  },
});

pool.connect()
  .then(client => {
    console.log('conectado');
    client.release();
  })
  .catch(err => {
    console.error('no conectado:', err.message || err); //! HELP
  });

module.exports = pool;