// src/services/reportes.service.js
const pool = require("../connect");
const { chat } = require("./ai-provider");
 
// Trae todas las transacciones de un mes/año específico
const getTransaccionesMes = async (anio, mes) => {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fin = new Date(anio, mes, 0); // último día del mes
  const finStr = `${anio}-${String(mes).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
 
  const result = await pool.query(
    `SELECT "id_transacción" AS id, date, description, category, type, amount
     FROM transacciones
     WHERE date >= $1 AND date <= $2
     ORDER BY date ASC`,
    [inicio, finStr]
  );
  return result.rows;
};
 
// Construye el reporte estándar a partir de las transacciones
const buildReporteEstandar = (transacciones, anio, mes) => {
  const MESES = [
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
 
  const ingresos = transacciones.filter((t) => t.type === "ingreso");
  const egresos  = transacciones.filter((t) => t.type === "egreso");
 
  const totalIngresos = ingresos.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalEgresos  = egresos.reduce((s, t) => s + parseFloat(t.amount), 0);
  const balance       = totalIngresos - totalEgresos;
 
  // Gastos por categoría
  const porCategoria = {};
  egresos.forEach((t) => {
    const cat = t.category || "Sin categoría";
    if (!porCategoria[cat]) porCategoria[cat] = { total: 0, count: 0 };
    porCategoria[cat].total += parseFloat(t.amount);
    porCategoria[cat].count += 1;
  });
 
  const categorias = Object.entries(porCategoria)
    .map(([nombre, data]) => ({
      nombre,
      total: data.total,
      count: data.count,
      porcentaje: totalEgresos > 0 ? ((data.total / totalEgresos) * 100).toFixed(1) : "0.0",
    }))
    .sort((a, b) => b.total - a.total);
 
  return {
    periodo: { mes: MESES[mes], anio, mesNum: mes },
    resumen: {
      totalIngresos,
      totalEgresos,
      balance,
      numTransacciones: transacciones.length,
      numIngresos: ingresos.length,
      numEgresos: egresos.length,
    },
    categorias,
    transacciones,
  };
};
 
// Llama a la IA para el análisis (Ollama o Gemini según AI_PROVIDER)
const getAnalisisIA = async (reporte) => {
  const { periodo, resumen, categorias } = reporte;
 
  const catResumen = categorias
    .slice(0, 6)
    .map((c) => `  - ${c.nombre}: $${c.total.toFixed(2)} (${c.porcentaje}%)`)
    .join("\n");
 
  const prompt = `Eres un asesor financiero de Banorte. Analiza estos datos financieros de ${periodo.mes} ${periodo.anio} y proporciona un análisis breve pero útil.
 
DATOS DEL MES:
- Ingresos totales: $${resumen.totalIngresos.toFixed(2)} MXN
- Egresos totales: $${resumen.totalEgresos.toFixed(2)} MXN
- Balance neto: $${resumen.balance.toFixed(2)} MXN
- Número de transacciones: ${resumen.numTransacciones}
 
GASTOS POR CATEGORÍA:
${catResumen}
 
Responde en español con el siguiente formato JSON (sin markdown, solo JSON):
{
  "patron_principal": "Una oración sobre el patrón de gasto más destacado",
  "categoria_critica": "Categoría que más impacta el presupuesto y por qué",
  "salud_financiera": "buenos|regular|crítico",
  "recomendaciones": [
    "Recomendación concreta 1",
    "Recomendación concreta 2",
    "Recomendación concreta 3"
  ],
  "proyeccion": "Qué podría mejorar o empeorar el próximo mes si sigue igual"
}`;

  const content = await chat([{ role: "user", content: prompt }]);
 
  // Extrae el JSON de la respuesta
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Respuesta IA sin formato válido");
 
  return JSON.parse(match[0]);
};
 
module.exports = {
  getTransaccionesMes,
  buildReporteEstandar,
  getAnalisisIA,
};