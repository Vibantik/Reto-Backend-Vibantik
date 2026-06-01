/**
 * intent-detector.js
 *
 * Detecta la intención del usuario y la mapea a una tool del registry.
 * Estrategia de dos niveles:
 *
 *   1. Pre-filtro por palabras clave (barato, sin latencia, sin costo de API).
 *   2. Gemini function-calling (preciso, semántico, requiere API key).
 *   3. Fallback heurístico si Gemini no está disponible o falla.
 *
 * El resultado es siempre { toolName, params } | null.
 */

const registry = require("./tool-registry");

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.GEMINI_API || "";
const GEMINI_MODEL   = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function hasGeminiKey() {
  return GEMINI_API_KEY && GEMINI_API_KEY !== "GEMINI_API_PLACEHOLDER";
}

/**
 * Convierte el array de mensajes al formato que espera Gemini.
 */
function toGeminiContents(messages = []) {
  return messages
    .filter((m) => m?.content && m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content) }],
    }));
}

// ─── Pre-filtro de keywords ────────────────────────────────────────────────────

/**
 * Mapa rápido de palabras clave → set de herramientas candidatas.
 * Si ninguna keyword dispara, saltamos directo a chat normal (no gastamos
 * llamada a Gemini function-calling).
 */
const KEYWORD_MAP = {
  // Metas
  meta: ["crear_meta", "listar_metas", "actualizar_meta", "eliminar_meta"],
  metas: ["crear_meta", "listar_metas", "actualizar_meta", "eliminar_meta"],
  objetivo: ["crear_meta", "listar_metas"],
  "ahorra para": ["crear_meta", "agregar_ahorro"],
  "quiero ahorrar": ["crear_meta"],
  "nueva meta": ["crear_meta"],
  "mi meta": ["listar_metas", "ver_progreso_ahorro"],
  progreso: ["ver_progreso_ahorro"],
  "depositar": ["agregar_ahorro"],
  "aporte": ["agregar_ahorro"],
  "agregar ahorro": ["agregar_ahorro"],

  // Presupuestos
  presupuesto: [
    "listar_presupuestos",
    "crear_presupuesto",
    "actualizar_presupuesto",
    "ver_presupuesto_activo",
  ],
  budget: ["listar_presupuestos", "crear_presupuesto"],
  "limite de gasto": ["crear_presupuesto", "actualizar_presupuesto"],
  "planear gasto": ["crear_presupuesto"],
  "mis presupuestos": ["listar_presupuestos"],

  // Inversiones
  inversion: ["listar_inversiones", "crear_inversion"],
  inversiones: ["listar_inversiones", "crear_inversion"],
  "invertir": ["crear_inversion"],
  "comprar cetes": ["crear_inversion"],
  "mis inversiones": ["listar_inversiones"],
  portafolio: ["listar_inversiones"],
  cetes: ["crear_inversion", "listar_inversiones"],
  acciones: ["crear_inversion", "listar_inversiones"],
  fondos: ["crear_inversion", "listar_inversiones"],

  // Movimientos
  movimientos: ["listar_movimientos", "resumen_gastos"],
  transacciones: ["listar_movimientos"],
  gastos: ["listar_movimientos", "resumen_gastos"],
  ingresos: ["listar_movimientos"],
  "cuanto gaste": ["resumen_gastos"],
  "cuanto gasté": ["resumen_gastos"],
  "resumen": ["resumen_gastos"],
  "mis gastos": ["resumen_gastos", "listar_movimientos"],
};

/**
 * Pre-filtra el mensaje y devuelve el set de tools candidatas.
 * Retorna null si no hay coincidencias (el chat responde normal).
 *
 * @param {string} message
 * @returns {Set<string>|null}
 */
function preFilterKeywords(message) {
  const norm = normalize(message);
  const candidates = new Set();

  for (const [keyword, tools] of Object.entries(KEYWORD_MAP)) {
    if (norm.includes(normalize(keyword))) {
      tools.forEach((t) => candidates.add(t));
    }
  }

  return candidates.size > 0 ? candidates : null;
}

// ─── Gemini function-calling ───────────────────────────────────────────────────

/**
 * Envía los mensajes a Gemini con las tools candidatas declaradas.
 * Gemini devuelve un functionCall que mapeamos a { toolName, params }.
 *
 * @param {object[]} messages
 * @param {Set<string>} candidateToolNames
 * @returns {Promise<{toolName: string, params: object}|null>}
 */
async function callGeminiIntentDetector(messages, candidateToolNames) {
  if (!hasGeminiKey()) return null;

  const allDeclarations = registry.toGeminiFunctionDeclarations();
  const filteredDeclarations = candidateToolNames
    ? allDeclarations.filter((d) => candidateToolNames.has(d.name))
    : allDeclarations;

  if (filteredDeclarations.length === 0) return null;

  const systemPrompt = `Eres el detector de intenciones de Vibantik, una app financiera.
Tu única tarea es identificar si el usuario quiere realizar una acción financiera concreta y
extraer los parámetros necesarios para ejecutarla.

Tools disponibles en este contexto:
${filteredDeclarations.map((d) => `- ${d.name}: ${d.description}`).join("\n")}

Reglas:
1. Si el usuario solo hace una pregunta o conversación general, NO llames ninguna tool.
2. Solo llama una tool si el usuario tiene intención clara de ejecutar una acción.
3. Extrae parámetros del contexto del mensaje. No inventes valores.
4. uuid_de_usuario NO lo extraigas del mensaje, se proporciona externamente.`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: toGeminiContents(messages),
    tools: [{ functionDeclarations: filteredDeclarations }],
    toolConfig: {
      functionCallingConfig: {
        mode: "AUTO",
      },
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini intent detection failed: ${res.status} – ${err}`);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const functionCall = parts.find((p) => p.functionCall)?.functionCall;

  if (!functionCall?.name) return null;

  return {
    toolName: functionCall.name,
    params: functionCall.args || {},
  };
}

// ─── Detector principal ────────────────────────────────────────────────────────

/**
 * Detecta la intención del usuario analizando el último mensaje.
 *
 * @param {object[]} messages       - historial de mensajes [{ role, content }]
 * @param {string}   uuidDeUsuario  - se inyecta en los params automáticamente
 * @returns {Promise<{toolName: string, params: object}|null>}
 */
async function detect(messages = [], uuidDeUsuario) {
  // Extraer el último mensaje del usuario
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m?.role === "user" && m?.content)?.content;

  if (!lastUserMsg) return null;

  // 1. Pre-filtro barato por keywords
  const candidates = preFilterKeywords(lastUserMsg);
  if (!candidates) return null; // sin match → no es agentic

  // 2. Gemini function-calling (semántico)
  try {
    const geminiResult = await callGeminiIntentDetector(messages, candidates);
    if (geminiResult) {
      // Inyectar uuid_de_usuario en los params que lo requieran
      geminiResult.params.uuid_de_usuario = uuidDeUsuario;
      return geminiResult;
    }
  } catch (err) {
    console.warn("[intent-detector] Gemini falló, usando fallback heurístico:", err.message);
  }

  // 3. Fallback heurístico: tomar la primera tool candidata
  const [firstCandidate] = [...candidates];
  const tool = registry.getByName(firstCandidate);
  if (!tool) return null;

  return {
    toolName: tool.name,
    params: { uuid_de_usuario: uuidDeUsuario },
  };
}

module.exports = { detect, preFilterKeywords };
