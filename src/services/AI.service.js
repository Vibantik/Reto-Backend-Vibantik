const pool = require("../connect");

const {
  TOOL_DEFINITIONS,
  getGeminiApiKey,
  getGeminiModel,
  buildTextAgenticResponse,
  planLegacyFinanceWizardResponse,
  shouldHandleFinanceIntent,
  shouldRouteToGenerativeUITooling,
} = require("./agentic/legacy-finance-router");

const { runFinanceAgentRuntime } = require("./agentic/adk-runtime");
const { chat } = require("./ai-provider");

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

  console.log(
    "[planAgenticResponse] shouldRouteToGenerativeUITooling:",
    routeToWizard
  );

  if (routeToWizard) {
    console.log("[planAgenticResponse] → finance wizard path");
    return planLegacyFinanceWizardResponse(messages);
  }

  const handleFinance = shouldHandleFinanceIntent(lastUserMessage);

  console.log("[planAgenticResponse] shouldHandleFinanceIntent:", handleFinance);

  if (!handleFinance) {
    console.log(
      "[planAgenticResponse] → null (no finance intent detected, will fall through to chat/Ollama)"
    );

    return null;
  }

  console.log("[planAgenticResponse] → ADK finance agent path");

  try {
    const adkResponse = await runFinanceAgentRuntime({
      messages,
      requestContext,
    });

    console.log(
      "[planAgenticResponse] ADK response:",
      adkResponse ? `type=${adkResponse.type}` : "null/undefined"
    );

    if (adkResponse) {
      return adkResponse;
    }
  } catch (error) {
    console.error(
      "[planAgenticResponse] ADK finance runtime error:",
      error.message || error
    );
  }

  console.log("[planAgenticResponse] → ADK null, trying Gemini direct chat fallback");
  try {
    const financeMessages = [
      {
        role: "system",
        content:
          "Eres Aura, asistente de finanzas personales de Vibantik. Respondes siempre en español. Ayudas con preguntas sobre presupuestos, metas de ahorro, inversiones y educación financiera. Si el usuario pregunta por datos específicos de su cuenta que no tienes, explícalo brevemente y orienta hacia la sección correcta de la app.",
      },
      ...messages,
    ];
    const geminiText = await chat(financeMessages);
    if (geminiText) {
      console.log("[planAgenticResponse] Gemini fallback succeeded");
      return buildTextAgenticResponse(geminiText, "gemini_fallback");
    }
  } catch (geminiErr) {
    console.error("[planAgenticResponse] Gemini fallback failed:", geminiErr.message);
  }

  console.log("[planAgenticResponse] → final hardcoded fallback");
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
    VALUES ($1, $2)
    RETURNING id_imagen;
  `;

  const result = await pool.query(query, [imagenOCR, id_msj]);

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