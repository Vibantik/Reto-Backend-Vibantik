
const TOOL_DEFINITIONS = [
  {
    name: "generate_budget_wizard",
    description:
      "Muestra un widget interactivo para proponer y confirmar un nuevo presupuesto mensual sin guardar datos hasta que el usuario confirme.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "Objetivo principal del usuario al planear el presupuesto.",
        },
        categoryHint: {
          type: "string",
          description: "Categoria mencionada por el usuario si existe.",
        },
        savingsGoalPercent: {
          type: "number",
          description: "Porcentaje de ahorro sugerido a partir del mensaje del usuario.",
        },
      },
      required: ["intent"],
    },
  },
];

// Wizzar q solo se activa PARA PRESUPUESTOS!!!
const WIZARD_SUBJECTS = [
  "presupuesto",
  "budget",
];

// Action verbs para presupuesto
const WIZARD_ACTION_VERBS = [
  "planear",
  "planifica",
  "planificar",
  "crear",
  "crea",
  "armar",
  "construir",
  "generar",
  "genera",
  "agregar",
  "agrega",
  "nuevo",
  "nueva",
  "ajustar",
  "reducir",
  "recortar",
  "redistribuir",
  "organizar",
  "iniciar",
  "inicia",
  "ayuda",
  "ayudame",
  "hacer",
  "haz",
  "quiero",
];

// Palabras y terminos de finanzas para routear a ADK
const FINANCE_SUBJECTS = [
  "meta", "metas",
  "inversion", "inversiones",
  "ahorro", "ahorros", "ahorrar",
  "presupuesto",
  "saldo",
  "ingreso", "ingresos",
  "portafolio",
  "rendimiento",
  "gasto", "gastos",
];

// "crear"/"nueva"/"nuevo"/"agregar" para metas/inversiones, sino esto como flag de finanzas personales
const PERSONAL_SIGNAL_RE = /\b(mi|mis|yo|tengo|tenemos|llevo|crear|nueva|nuevo|agregar)\b/;

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
    .replace(/[̀-ͯ]/g, "");

const extractSavingsGoalPercent = (text) => {
  const match = text.match(/(\d{1,2})\s*%/);
  if (!match) return null;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 90) return null;
  return parsed;
};

const isStructuredJsonPrompt = (text = "") => {
  const normalized = normalizeText(text);
  return (
    normalized.includes("solo json") ||
    normalized.includes("json valido") ||
    normalized.includes("formato exacto") ||
    normalized.includes("responde exactamente") ||
    normalized.includes("sin markdown")
  );
};

// ADK para cuando el usuario pregunta sobre sus finanzas
// "como ahorrar dinero" sin señal personal se va a chatStream
const shouldHandleFinanceIntent = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);
  if (!normalized || isStructuredJsonPrompt(normalized)) return false;

  const hasFinanceSubject = FINANCE_SUBJECTS.some((keyword) => normalized.includes(keyword));
  return hasFinanceSubject && PERSONAL_SIGNAL_RE.test(normalized);
};

// Budget wizard con palabra de presupuesto y verbo de hacer, crear, etc
const shouldRouteToGenerativeUITooling = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);
  if (!normalized || isStructuredJsonPrompt(normalized)) return false;

  const hasWizardSubject = WIZARD_SUBJECTS.some((keyword) =>
    normalized.includes(keyword)
  );
  const hasActionVerb = WIZARD_ACTION_VERBS.some((keyword) =>
    normalized.includes(keyword)
  );

  return hasWizardSubject && hasActionVerb;
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

const buildTextAgenticResponse = (content, source = "adk") => ({
  type: "assistant_text",
  message: {
    content,
  },
  meta: {
    source,
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

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY ||
  process.env.GEMINI_API ||
  "GEMINI_API_PLACEHOLDER";

const getGeminiModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

const hasGeminiApiKey = () => {
  const apiKey = getGeminiApiKey();
  return apiKey && apiKey !== "GEMINI_API_PLACEHOLDER";
};

const toGeminiContents = (messages = []) =>
  messages
    .filter((message) => message?.content)
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content) }],
    }));

const callGeminiToolRouter = async (messages = []) => {
  if (!hasGeminiApiKey()) return null;

  const apiKey = getGeminiApiKey();
  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "Eres el router de UI generativa de Vibantik. Llama generate_budget_wizard unicamente cuando el usuario quiera crear, planear, ajustar o reducir un presupuesto. No guardes datos ni ejecutes acciones; solo devuelve la llamada de herramienta con argumentos seguros.",
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
          mode: "AUTO",
          // allowedFunctionNames only valid with mode "ANY" per Gemini docs
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

const planLegacyBudgetWizardResponse = async (messages = []) => {
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

module.exports = {
  TOOL_DEFINITIONS,
  buildBudgetToolPayload,
  buildTextAgenticResponse,
  getGeminiApiKey,
  getGeminiModel,
  hasGeminiApiKey,
  isStructuredJsonPrompt,
  normalizeText,
  planLegacyBudgetWizardResponse,
  shouldHandleFinanceIntent,
  shouldRouteToGenerativeUITooling,
  toGeminiContents,
};
