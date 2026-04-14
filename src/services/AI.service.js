const pool = require("../connect");

const Imagesave = async (id_msj, imagenOCR) => {
  if (!id_msj) {
    throw new Error("ID del mensaje es requerido");
  }

  const query = `
    INSERT INTO Imagen (texto_extraido_ocr, id_msj)
    VALUES (imagenOCR, id_msj)
    RETURNING id_imagen;
  `;
  const result = await pool.query(query, [id_msj,imagenOCR ]);
  return result.rows[0].id_imagen;
};

module.exports = {
  Imagesave
};
