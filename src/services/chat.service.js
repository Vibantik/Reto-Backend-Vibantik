const pool = require("../connect");

const startConversation = async (uuidDeUsuario) => {
  if (!uuidDeUsuario) {
    throw new Error("uuid_de_usuario es requerido");
  }

  const query = `
    INSERT INTO Conversacion (uuid_de_usuario)
    VALUES ($1)
    RETURNING id_conv;
  `;

  const result = await pool.query(query, [uuidDeUsuario]);
  return result.rows[0].id_conv;
};

const getConversations = async (uuidDeUsuario) => {
 if (!uuidDeUsuario) {
    throw new Error("uuid_de_usuario es requerido");
  }

  const query = `
    SELECT * FROM Conversacion WHERE uuid_de_usuario = $1;
  `;

  const result = await pool.query(query, [uuidDeUsuario]);
  return result.rows;
};

const getMessages = async (idConv) => {
 if (!idConv) {
    throw new Error("id_conv es requerido");
  }

  const query = `
    SELECT * FROM Mensaje WHERE id_conv = $1;
  `;

  const result = await pool.query(query, [idConv]);
  return result.rows;
};


const saveMessage = async (idConv, mensajeUsuario, respuestaIa) => {
  const query = ` INSERT INTO Mensaje (mensaje_usuario, respuesta_ia, id_conv) 
  VALUES ($1, $2, $3) RETURNING id_msj;`;

  const result = await pool.query(query, [mensajeUsuario, respuestaIa, idConv]);
  return result.rows[0].id_msj;
};

module.exports = {
  startConversation,
  saveMessage,
  getConversations,
  getMessages
};
