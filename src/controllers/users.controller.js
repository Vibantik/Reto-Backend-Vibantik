const pool = require("../connect");

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uuid_de_usuario, nombre, apellido
       FROM usuario`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener usuarios:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = { getUsers };
