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
const { planConfirmableAction } = require("./agentic/agent-actions.service");

const GEMINI_API = getGeminiApiKey();
const GEMINI_MODEL = getGeminiModel();

const planAgenticResponse = async (messages = [], requestContext = {}) => {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && message?.content)?.content;

  if (!lastUserMessage) {
    return null;
  }

  const actionProposal = planConfirmableAction(messages, requestContext);
  if (actionProposal) {
    return actionProposal;
  }

  if (shouldRouteToGenerativeUITooling(lastUserMessage)) {
    return planLegacyBudgetWizardResponse(messages);
  }

  if (!shouldHandleFinanceIntent(lastUserMessage)) {
    return null;
  }

  try {
    const adkResponse = await runFinanceAgentRuntime({
      messages,
      requestContext,
    });

    if (adkResponse) {
      return adkResponse;
    }
  } catch (error) {
    console.error("ADK finance runtime error:", error.message || error);
  }

  // ADK no disponible y evitar alucionaciones
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
