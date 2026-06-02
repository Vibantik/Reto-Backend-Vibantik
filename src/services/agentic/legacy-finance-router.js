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
          description:
            "Porcentaje de ahorro sugerido a partir del mensaje del usuario.",
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
      "Muestra un widget interactivo para crear una meta de ahorro sin guardar datos hasta que el usuario confirme.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "Objetivo principal del usuario al crear la meta.",
        },
        goalNameHint: {
          type: "string",
          description: "Nombre o proposito de la meta mencionado por el usuario.",
        },
        targetAmount: {
          type: "number",
          description: "Monto objetivo detectado si el usuario lo menciona.",
        },
        deadlineHint: {
          type: "string",
          description: "Fecha o plazo mencionado por el usuario.",
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

const BUDGET_WIZARD_SUBJECTS = [
  "presupuesto",
  "presupuestos",
  "budget",
];

const GOAL_WIZARD_SUBJECTS = [
  "meta",
  "metas",
  "objetivo",
  "objetivos",
  "ahorro",
  "ahorros",
  "ahorrar",
];

// Verbos que indican que el usuario quiere crear/planear/ajustar algo.
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

// Palabras y terminos de finanzas para routear al ADK cuando NO sea wizard.
const FINANCE_SUBJECTS = [
  "meta",
  "metas",
  "inversion",
  "inversiones",
  "invertir",
  "invirtiendo",
  "ahorro",
  "ahorros",
  "ahorrar",
  "presupuesto",
  "presupuestos",
  "saldo",
  "ingreso",
  "ingresos",
  "portafolio",
  "rendimiento",
  "gasto",
  "gastos",
];

// Señales de que habla de sus propias finanzas.
const PERSONAL_SIGNAL_RE =
  /\b(mi|mis|yo|tengo|tenemos|llevo|crear|nueva|nuevo|agregar|puedo|quiero|empezar|empezare|empiezo|ayudame|hazme|hacer)\b/;

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

const GOAL_HINTS = [
  "viaje",
  "viajes",
  "carro",
  "coche",
  "auto",
  "laptop",
  "computadora",
  "emergencia",
  "emergencias",
  "renta",
  "casa",
  "departamento",
  "universidad",
  "intercambio",
  "maestria",
  "curso",
  "celular",
  "telefono",
];

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const extractSavingsGoalPercent = (text = "") => {
  const match = String(text).match(/(\d{1,2})\s*%/);
  if (!match) return null;

  const parsed = Number(match[1]);

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 90) return null;

  return parsed;
};

const extractMoneyAmount = (text = "") => {
  const normalized = normalizeText(text);

  const moneyMatch =
    normalized.match(/\$\s*(\d+(?:[.,]\d+)?)/) ||
    normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:mxn|pesos|peso)/) ||
    normalized.match(/(?:de|por|para)\s+(\d+(?:[.,]\d+)?)/);

  if (!moneyMatch) return null;

  const parsed = Number(String(moneyMatch[1]).replace(",", "."));

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
};

const inferGoalNameHint = (text = "") => {
  const normalized = normalizeText(text);

  const matchedGoal = GOAL_HINTS.find((goal) => normalized.includes(goal));

  if (matchedGoal) return matchedGoal;

  const paraMatch = normalized.match(/(?:para|por)\s+(?:un|una|mi|mis)?\s*([a-z0-9\s]{3,40})/);

  if (!paraMatch) return null;

  return paraMatch[1]
    .replace(/\b(de|por|con|en|mxn|pesos|peso)\b/g, "")
    .trim();
};

const inferDeadlineHint = (text = "") => {
  const normalized = normalizeText(text);

  const deadlineMatch =
    normalized.match(/en\s+(\d+)\s+(dias|dia|semanas|semana|meses|mes|anos|ano)/) ||
    normalized.match(/para\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);

  if (!deadlineMatch) return null;

  return deadlineMatch[0];
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

const getWizardTarget = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);

  if (!normalized || isStructuredJsonPrompt(normalized)) return null;

  const matchedActionVerb = WIZARD_ACTION_VERBS.find((keyword) =>
    normalized.includes(keyword)
  );

  if (!matchedActionVerb) return null;

  const matchedBudgetSubject = BUDGET_WIZARD_SUBJECTS.find((keyword) =>
    normalized.includes(keyword)
  );

  if (matchedBudgetSubject) return "budget";

  const matchedGoalSubject = GOAL_WIZARD_SUBJECTS.find((keyword) =>
    normalized.includes(keyword)
  );

  if (matchedGoalSubject) return "goal";

  return null;
};

// ADK para cuando el usuario pregunta sobre sus finanzas.
// Ejemplo: "cuanto llevo ahorrado en mis metas".
const shouldHandleFinanceIntent = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);

  if (!normalized || isStructuredJsonPrompt(normalized)) return false;

  const matchedFinanceKeyword = FINANCE_SUBJECTS.find((keyword) =>
    normalized.includes(keyword)
  );

  const hasFinanceSubject = Boolean(matchedFinanceKeyword);
  const hasPersonalSignal = PERSONAL_SIGNAL_RE.test(normalized);

  console.log(
    `[shouldHandleFinanceIntent] normalized="${normalized}" | financeKeyword=${
      matchedFinanceKeyword || "none"
    } | personalSignal=${hasPersonalSignal}`
  );

  return hasFinanceSubject && hasPersonalSignal;
};

// Wizard cuando quiere crear/planear/agregar presupuesto o meta.
const shouldRouteToGenerativeUITooling = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);
  const wizardTarget = getWizardTarget(normalized);

  console.log(
    `[shouldRouteToGenerativeUITooling] normalized="${normalized}" | wizardTarget=${
      wizardTarget || "none"
    }`
  );

  return Boolean(wizardTarget);
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
      "Preparé un asistente para construir tu presupuesto sin guardar nada hasta que lo confirmes.",
  },
});

const buildGoalToolPayload = (args = {}, source = "heuristic") => ({
  type: "ui_tool",
  tool: "generate_goal_wizard",
  data: {
    intent: args.intent || "create_goal",
    goalNameHint: args.goalNameHint || args.categoryHint || null,
    targetAmount: Number(args.targetAmount || 0) || null,
    deadlineHint: args.deadlineHint || null,
    source,
  },
  message: {
    content:
      "Preparé un asistente para crear tu meta de ahorro sin guardar nada hasta que la confirmes.",
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

const inferGoalIntent = (lastUserMessage = "") => {
  const normalized = normalizeText(lastUserMessage);

  return buildGoalToolPayload(
    {
      intent: "create_goal",
      goalNameHint: inferGoalNameHint(normalized),
      targetAmount: extractMoneyAmount(normalized),
      deadlineHint: inferDeadlineHint(normalized),
    },
    "heuristic"
  );
};

const inferWizardIntent = (lastUserMessage = "") => {
  const wizardTarget = getWizardTarget(lastUserMessage);

  if (wizardTarget === "goal") {
    return inferGoalIntent(lastUserMessage);
  }

  if (wizardTarget === "budget") {
    return inferBudgetIntent(lastUserMessage);
  }

  return null;
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
              "Eres el router de UI generativa de Vibantik. Llama generate_budget_wizard o generate_goal_wizard unicamente cuando el usuario quiera crear, planear, ajustar o reducir un presupuesto o una meta de ahorro. No guardes datos ni ejecutes acciones; solo devuelve la llamada de herramienta con argumentos seguros.",
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

  if (!functionCall) return null;

  if (functionCall.name === "generate_budget_wizard") {
    return buildBudgetToolPayload(functionCall.args || {}, "gemini");
  }

  if (functionCall.name === "generate_goal_wizard") {
    return buildGoalToolPayload(functionCall.args || {}, "gemini");
  }

  return null;
};

const planLegacyFinanceWizardResponse = async (messages = []) => {
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
  buildGoalToolPayload,
  buildTextAgenticResponse,
  getGeminiApiKey,
  getGeminiModel,
  getWizardTarget,
  hasGeminiApiKey,
  isStructuredJsonPrompt,
  normalizeText,
  planLegacyFinanceWizardResponse,
  shouldHandleFinanceIntent,
  shouldRouteToGenerativeUITooling,
  toGeminiContents,
};