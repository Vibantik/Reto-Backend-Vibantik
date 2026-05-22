const pool = require("../connect");

const GEMINI_API = process.env.GEMINI_API || "GEMINI_API_PLACEHOLDER";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const TOOL_DEFINITIONS = [
  {
    name: "generate_budget_wizard",
    description:
      "Muestra un widget interactivo para proponer y confirmar un nuevo presupuesto mensual sin guardar datos hasta que el usuario confirme.",
    parameters: {
      type: "OBJECT",
      properties: {
        intent: {
          type: "STRING",
          description: "Objetivo principal del usuario al planear el presupuesto.",
        },
        categoryHint: {
          type: "STRING",
          description: "Categoria mencionada por el usuario si existe.",
        },
        savingsGoalPercent: {
          type: "NUMBER",
          description: "Porcentaje de ahorro sugerido a partir del mensaje del usuario.",
        },
      },
      required: ["intent"],
    },
  },
];

const BUDGET_KEYWORDS = [
  "presupuesto",
  "budget",
  "ahorro",
  "ahorrar",
  "gasto",
  "gastos",
  "planear",
  "planifica",
  "reducir",
  "recortar",
  "mensual",
  "mes",
];

const CATEGORY_HINTS = [
  "comida",
  "alimentos",
  "transporte",
  "hogar",
  "servicios",
  "entretenimiento",
  "salud",
  "educacion",
  "viajes",
  "shopping",
];

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const extractSavingsGoalPercent = (text) => {
  const match = text.match(/(\d{1,2})\s*%/);
  if (!match) return null;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 90) return null;
  return parsed;
};

const shouldRouteToGenerativeUITooling = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);
  if (!normalized) return false;

  return BUDGET_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );
};

const buildBudgetToolPayload = (args = {}, source = "heuristic") => ({
  type: "ui_tool",
  tool: "generate_budget_wizard",
  data: {
    intent: args.intent || "plan_budget",
    categoryHint: args.categoryHint || null,
    savingsGoalPercent: Number(args.savingsGoalPercent || 10),
    source,
  },
  message: {
    content:
      "Prepare un asistente para construir tu presupuesto sin guardar nada hasta que lo confirmes.",
  },
});

const inferBudgetIntent = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);
  if (!shouldRouteToGenerativeUITooling(normalized)) return null;

  const categoryHint =
    CATEGORY_HINTS.find((category) => normalized.includes(category)) || null;
  const savingsGoalPercent = extractSavingsGoalPercent(normalized) || 10;

  return buildBudgetToolPayload(
    {
      intent: normalized.includes("reduc")
        ? "reduce_expenses"
        : normalized.includes("ahorr")
          ? "increase_savings"
          : "plan_budget",
      categoryHint,
      savingsGoalPercent,
    },
    "heuristic"
  );
};

const hasGeminiApiKey = () =>
  GEMINI_API && GEMINI_API !== "GEMINI_API_PLACEHOLDER";

const toGeminiContents = (messages = []) =>
  messages
    .filter((message) => message?.content)
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content) }],
    }));

const callGeminiToolRouter = async (messages = []) => {
  if (!hasGeminiApiKey()) return null;

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "Eres el router de UI generativa de Vibantik. Solo llama generate_budget_wizard cuando el usuario quiera planear, crear, ajustar o reducir un presupuesto. No guardes datos ni ejecutes acciones; solo devuelve la llamada de herramienta con argumentos seguros.",
          },
        ],
      },
      contents: toGeminiContents(messages),
      tools: [
        {
          functionDeclarations: TOOL_DEFINITIONS,
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["generate_budget_wizard"],
        },
      },
    }),
  });

  if (!geminiRes.ok) {
    throw new Error(`Gemini tool routing failed with status ${geminiRes.status}`);
  }

  const geminiJson = await geminiRes.json();
  const parts = geminiJson?.candidates?.[0]?.content?.parts || [];
  const functionCall = parts.find((part) => part.functionCall)?.functionCall;

  if (functionCall?.name !== "generate_budget_wizard") {
    return null;
  }

  return buildBudgetToolPayload(functionCall.args || {}, "gemini");
};

const planAgenticResponse = async (messages = []) => {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && message?.content)?.content;

  if (!shouldRouteToGenerativeUITooling(lastUserMessage)) {
    return null;
  }

  try {
    const geminiToolResponse = await callGeminiToolRouter(messages);
    if (geminiToolResponse) {
      return geminiToolResponse;
    }
  } catch (error) {
    console.error("Gemini tool routing error:", error.message || error);
  }

  return inferBudgetIntent(lastUserMessage);
};

const Imagesave = async (id_msj, imagenOCR) => {
  if (!id_msj) {
    throw new Error("ID del mensaje es requerido");
  }

  const query = `
    INSERT INTO Imagen (texto_extraido_ocr, id_msj)
    VALUES (imagenOCR, id_msj)
    RETURNING id_imagen;
  `;
  const result = await pool.query(query, [id_msj, imagenOCR]);
  return result.rows[0].id_imagen;
};

module.exports = {
  GEMINI_API,
  GEMINI_MODEL,
  TOOL_DEFINITIONS,
  Imagesave,
  shouldRouteToGenerativeUITooling,
  planAgenticResponse,
};
