const pool = require("../connect");
const {
  TOOL_DEFINITIONS,
  getGeminiApiKey,
  getGeminiModel,
  buildTextAgenticResponse,
  planLegacyBudgetWizardResponse,
  shouldHandleFinanceIntent,
  shouldRouteToGenerativeUITooling,
} = require("./agentic/legacy-finance-router");
const { runFinanceAgentRuntime } = require("./agentic/adk-runtime");

const GEMINI_API = getGeminiApiKey();
const GEMINI_MODEL = getGeminiModel();

const planAgenticResponse = async (messages = [], requestContext = {}) => {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && message?.content)?.content;

  console.log("[planAgenticResponse] lastUserMessage:", lastUserMessage);

  if (!lastUserMessage) {
    console.log("[planAgenticResponse] → null (no user message found)");
    return null;
  }

  const routeToWizard = shouldRouteToGenerativeUITooling(lastUserMessage);
  console.log("[planAgenticResponse] shouldRouteToGenerativeUITooling:", routeToWizard);
  if (routeToWizard) {
    console.log("[planAgenticResponse] → budget wizard path");
    return planLegacyBudgetWizardResponse(messages);
  }

  const handleFinance = shouldHandleFinanceIntent(lastUserMessage);
  console.log("[planAgenticResponse] shouldHandleFinanceIntent:", handleFinance);
  if (!handleFinance) {
    console.log("[planAgenticResponse] → null (no finance intent detected, will fall through to chat/Ollama)");
    return null;
  }

  console.log("[planAgenticResponse] → ADK finance agent path");
  try {
    const adkResponse = await runFinanceAgentRuntime({
      messages,
      requestContext,
    });

    console.log("[planAgenticResponse] ADK response:", adkResponse ? `type=${adkResponse.type}` : "null/undefined");
    if (adkResponse) {
      return adkResponse;
    }
  } catch (error) {
    console.error("[planAgenticResponse] ADK finance runtime error:", error.message || error);
  }

  // ADK no disponible y evitar alucionaciones
  console.log("[planAgenticResponse] → fallback text (ADK returned null or failed)");
  return buildTextAgenticResponse(
    "Para consultar información detallada de tus finanzas personales, revisa las secciones de Gastos, Presupuestos o Metas en la app.",
    "fallback"
  );
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
  shouldHandleFinanceIntent,
  shouldRouteToGenerativeUITooling,
  planAgenticResponse,
};
