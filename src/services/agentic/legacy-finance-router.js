
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
        source: {
          type: "string",
          description: "Origen del enrutamiento del wizard.",
        },
      },
      required: ["intent"],
    },
  },
  {
    name: "generate_goal_wizard",
    description:
      "Muestra un asistente para crear o ajustar una meta de ahorro o ahorro específico sin guardar datos hasta que el usuario confirme.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "Objetivo principal del usuario al crear o ajustar una meta.",
        },
        categoryHint: {
          type: "string",
          description: "Categoria o contexto de la meta si existe.",
        },
        savingsGoalPercent: {
          type: "number",
          description: "Porcentaje de ahorro sugerido asociado con la meta.",
        },
        source: {
          type: "string",
          description: "Origen del enrutamiento del wizard.",
        },
      },
      required: ["intent"],
    },
  },
  {
    name: "generate_investment_wizard",
    description:
      "Muestra un asistente para crear o ajustar una inversion sin guardar datos hasta que el usuario confirme.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "Objetivo principal del usuario al crear o ajustar una inversion.",
        },
        categoryHint: {
          type: "string",
          description: "Tipo de inversion o contexto si existe.",
        },
        savingsGoalPercent: {
          type: "number",
          description: "Porcentaje de ahorro o monto sugerido relacionado con la inversion.",
        },
        source: {
          type: "string",
          description: "Origen del enrutamiento del wizard.",
        },
      },
      required: ["intent"],
    },
  },
];

// Wizzar q se activa para presupuestos, metas e inversiones
const WIZARD_SUBJECTS = [
  "presupuesto",
  "budget",
  "meta",
  "metas",
  "inversion",
  "inversiones",
  "ahorro",
  "ahorros",
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
  "inversion", "inversiones", "invertir", "invirtiendo",
  "ahorro", "ahorros", "ahorrar",
  "presupuesto",
  "saldo",
  "ingreso", "ingresos",
  "portafolio",
  "rendimiento",
  "gasto", "gastos",
];

// "crear"/"nueva"/"nuevo"/"agregar" para metas/inversiones, sino esto como flag de finanzas personales
const PERSONAL_SIGNAL_RE = /\b(mi|mis|yo|tengo|tenemos|llevo|crear|nueva|nuevo|agregar|puedo|quiero|empezar|empezaré|empiezo)\b/;

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

  const matchedFinanceKeyword = FINANCE_SUBJECTS.find((keyword) => normalized.includes(keyword));
  const hasFinanceSubject = Boolean(matchedFinanceKeyword);
  const hasPersonalSignal = PERSONAL_SIGNAL_RE.test(normalized);

  console.log(
    `[shouldHandleFinanceIntent] normalized="${normalized}" | financeKeyword=${matchedFinanceKeyword || "none"} | personalSignal=${hasPersonalSignal}`
  );

  return hasFinanceSubject && hasPersonalSignal;
};

// Budget wizard con palabra de presupuesto y verbo de hacer, crear, etc
const shouldRouteToGenerativeUITooling = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);
  if (!normalized || isStructuredJsonPrompt(normalized)) return false;

  const matchedWizardSubject = WIZARD_SUBJECTS.find((keyword) => normalized.includes(keyword));
  const matchedActionVerb = WIZARD_ACTION_VERBS.find((keyword) => normalized.includes(keyword));
  const hasWizardSubject = Boolean(matchedWizardSubject);
  const hasActionVerb = Boolean(matchedActionVerb);

  console.log(
    `[shouldRouteToGenerativeUITooling] normalized="${normalized}" | wizardSubject=${matchedWizardSubject || "none"} | actionVerb=${matchedActionVerb || "none"}`
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

const buildGoalToolPayload = (args = {}, source = "heuristic") => ({
  type: "ui_tool",
  tool: "generate_goal_wizard",
  data: {
    intent: args.intent || "create_goal",
    categoryHint: args.categoryHint || null,
    savingsGoalPercent: Number(args.savingsGoalPercent || 10),
    source,
  },
  message: {
    content:
      "Prepare un asistente para crear o ajustar una meta de ahorro sin guardar nada hasta que lo confirme.",
  },
});

const buildInvestmentToolPayload = (args = {}, source = "heuristic") => ({
  type: "ui_tool",
  tool: "generate_investment_wizard",
  data: {
    intent: args.intent || "create_investment",
    categoryHint: args.categoryHint || null,
    savingsGoalPercent: Number(args.savingsGoalPercent || 10),
    source,
  },
  message: {
    content:
      "Prepare un asistente para crear o ajustar una inversion sin guardar nada hasta que lo confirme.",
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

const inferWizardIntent = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);
  if (!shouldRouteToGenerativeUITooling(normalized)) return null;

  const categoryHint =
    CATEGORY_HINTS.find((category) => normalized.includes(category)) || null;
  const savingsGoalPercent = extractSavingsGoalPercent(normalized) || 10;

  if (/\bmeta\b|\bmetas\b|\bahorro\b|\bahorros\b/.test(normalized)) {
    return buildGoalToolPayload(
      {
        intent: normalized.includes("reduc")
          ? "reduce_savings_goal"
          : normalized.includes("ahorr")
            ? "increase_savings_goal"
            : "create_goal",
        categoryHint,
        savingsGoalPercent,
      },
      "heuristic"
    );
  }

  if (/\binversion\b|\binversiones\b|\bportafolio\b/.test(normalized)) {
    return buildInvestmentToolPayload(
      {
        intent: normalized.includes("reduc")
          ? "reduce_investment"
          : normalized.includes("ahorr")
            ? "allocate_investment"
            : "create_investment",
        categoryHint,
        savingsGoalPercent,
      },
      "heuristic"
    );
  }

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
              "Eres el router de UI generativa de Vibantik. Llama generate_budget_wizard, generate_goal_wizard o generate_investment_wizard unicamente cuando el usuario quiera crear, planear, ajustar o reducir un presupuesto, una meta o una inversion. No guardes datos ni ejecutes acciones; solo devuelve la llamada de herramienta con argumentos seguros.",
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

  if (!functionCall) {
    return null;
  }

  if (functionCall.name === "generate_budget_wizard") {
    return buildBudgetToolPayload(functionCall.args || {}, "gemini");
  }

  if (functionCall.name === "generate_goal_wizard") {
    return buildGoalToolPayload(functionCall.args || {}, "gemini");
  }

  if (functionCall.name === "generate_investment_wizard") {
    return buildInvestmentToolPayload(functionCall.args || {}, "gemini");
  }

  return null;
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

  return inferWizardIntent(lastUserMessage);
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
