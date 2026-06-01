import { mkdir, appendFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FunctionTool,
  InMemoryMemoryService,
  InMemorySessionService,
  LlmAgent,
  Runner,
  isFinalResponse,
} from "@google/adk";
import { createUserContent } from "@google/genai";
import { z } from "zod";

const require = createRequire(import.meta.url);
const {
  getBudgetSnapshot,
  getGoalsSnapshot,
  getInvestmentsSnapshot,
  getFinancialOverview,
} = require("./finance-domain.service");
const {
  buildTextAgenticResponse,
} = require("./legacy-finance-router");

const APP_NAME = "vibantik_finance_agent";
const sessionService = new InMemorySessionService();
const memoryService = new InMemoryMemoryService();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const traceFilePath = path.join(
  __dirname,
  "../../logs/agent-traces/finance-agent.ndjson"
);

const ensureGeminiApiKey = () => {
  if (!process.env.GEMINI_API_KEY && process.env.GEMINI_API) {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API;
  }

  return Boolean(process.env.GEMINI_API_KEY);
};

const appendTrace = async (entry) => {
  await mkdir(path.dirname(traceFilePath), { recursive: true });
  await appendFile(
    traceFilePath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    })}\n`
  );
};

const getRequestIds = (requestContext = {}) => ({
  sessionId:
    requestContext.conversationId ||
    `finance-session:${requestContext.userUuid || "anonymous"}`,
  userId: requestContext.userUuid || "anonymous",
});

const createReadOnlyPolicyMessage = () =>
  "Solo puedo consultar y resumir informacion financiera en este flujo. Para crear o modificar datos usa el wizard o las pantallas dedicadas.";

const createToolCallbacks = (requestContext = {}) => {
  const beforeToolCallback = async ({ tool, args }) => {
    await appendTrace({
      stage: "before_tool",
      tool: tool.name,
      args,
      userUuid: requestContext.userUuid || null,
    });

    if (!requestContext.userUuid) {
      return {
        error:
          "No tengo el uuid del usuario en este flujo, asi que no puedo consultar presupuestos, metas o inversiones personales.",
      };
    }

    return undefined;
  };

  const afterAgentCallback = async ({ invocationContext, agentName }) => {
    try {
      await invocationContext?.memoryService?.addSessionToMemory(
        invocationContext?.session
      );
    } catch (error) {
      await appendTrace({
        stage: "memory_save_error",
        agentName,
        error: String(error?.message || error),
      });
    }

    await appendTrace({
      stage: "after_agent",
      agentName,
      sessionId: invocationContext?.session?.id || null,
      userId: invocationContext?.session?.userId || null,
    });

    return undefined;
  };

  return {
    beforeToolCallback,
    afterAgentCallback,
  };
};

const createSharedAgentConfig = (requestContext, instruction, tools = []) => {
  const { beforeToolCallback, afterAgentCallback } =
    createToolCallbacks(requestContext);

  return {
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    instruction,
    tools,
    beforeToolCallback,
    afterAgentCallback,
  };
};

const createFinanceTools = (requestContext = {}) => {
  const budgetSnapshotTool = new FunctionTool({
    name: "get_budget_snapshot",
    description:
      "Consulta el estado actual del presupuesto del usuario, incluyendo presupuesto activo, ultimo presupuesto y saldo restante.",
    parameters: z.object({}),
    execute: async () => getBudgetSnapshot(requestContext.userUuid),
  });

  const goalsSnapshotTool = new FunctionTool({
    name: "get_goals_snapshot",
    description:
      "Consulta las metas de ahorro del usuario, su progreso promedio y las metas mas relevantes.",
    parameters: z.object({}),
    execute: async () => getGoalsSnapshot(requestContext.userUuid),
  });

  const investmentsSnapshotTool = new FunctionTool({
    name: "get_investments_snapshot",
    description:
      "Consulta las inversiones del usuario, el capital activo y los vencimientos proximos.",
    parameters: z.object({}),
    execute: async () => getInvestmentsSnapshot(requestContext.userUuid),
  });

  const financialOverviewTool = new FunctionTool({
    name: "get_financial_overview",
    description:
      "Carga un panorama combinado de presupuestos, metas e inversiones para preguntas transversales.",
    parameters: z.object({}),
    execute: async () => getFinancialOverview(requestContext.userUuid),
  });

  const financeMemoryTool = new FunctionTool({
    name: "search_finance_memory",
    description:
      "Busca recuerdos recientes de esta conversacion para mantener continuidad al responder sobre preferencias y contexto financiero.",
    parameters: z.object({
      query: z
        .string()
        .min(3)
        .describe("Consulta corta para recuperar recuerdos relevantes."),
    }),
    execute: async ({ query }, toolContext) => {
      const results = await toolContext.searchMemory(query);
      return {
        results: (results || []).slice(0, 5),
      };
    },
  });

  return {
    budgetSnapshotTool,
    goalsSnapshotTool,
    investmentsSnapshotTool,
    financialOverviewTool,
    financeMemoryTool,
  };
};

const createFinanceAgent = (requestContext = {}) => {
  const {
    budgetSnapshotTool,
    goalsSnapshotTool,
    investmentsSnapshotTool,
    financialOverviewTool,
    financeMemoryTool,
  } = createFinanceTools(requestContext);

  const budgetAdvisor = new LlmAgent({
    name: "budget_advisor",
    description:
      "Especialista en presupuestos mensuales, saldo restante, control del gasto y ajustes sugeridos.",
    ...createSharedAgentConfig(
      requestContext,
      [
        "Eres el especialista de presupuestos de Vibantik.",
        "Consulta datos reales antes de responder.",
        "No inventes montos.",
        createReadOnlyPolicyMessage(),
      ].join(" "),
      [budgetSnapshotTool]
    ),
  });

  const goalsCoach = new LlmAgent({
    name: "goals_coach",
    description:
      "Especialista en metas de ahorro, progreso, proximos vencimientos y recomendaciones accionables.",
    ...createSharedAgentConfig(
      requestContext,
      [
        "Eres el especialista en metas de ahorro de Vibantik.",
        "Usa las metas reales del usuario para explicar progreso, riesgos y siguientes pasos.",
        createReadOnlyPolicyMessage(),
      ].join(" "),
      [goalsSnapshotTool]
    ),
  });

  const investmentAdvisor = new LlmAgent({
    name: "investment_advisor",
    description:
      "Especialista en inversiones, capital activo, vencimientos proximos y diversificacion.",
    ...createSharedAgentConfig(
      requestContext,
      [
        "Eres el especialista en inversiones de Vibantik.",
        "Usa solo los datos consultados y evita recomendaciones regulatorias o promesas de rendimiento.",
        createReadOnlyPolicyMessage(),
      ].join(" "),
      [investmentsSnapshotTool]
    ),
  });

  return new LlmAgent({
    name: "finance_concierge",
    description:
      "Concierge financiero que coordina ayuda entre presupuestos, metas e inversiones.",
    subAgents: [budgetAdvisor, goalsCoach, investmentAdvisor],
    ...createSharedAgentConfig(
      requestContext,
      [
        "Eres Aura Finance Concierge para Vibantik y respondes siempre en espanol.",
        "Tu rol es dar ayuda util y controlada sobre presupuestos, metas e inversiones.",
        "Antes de afirmar datos del usuario, consulta una tool o delega a un subagente especialista.",
        "Si faltan datos del usuario, dilo con claridad y pide continuar desde el chatbot autenticado.",
        "No ejecutes cambios de escritura en este flujo.",
        "Si la pregunta cruza varias areas, usa get_financial_overview y luego sintetiza de forma clara.",
      ].join(" "),
      [financialOverviewTool, financeMemoryTool]
    ),
  });
};

const ensureSession = async ({ userId, sessionId }) => {
  const existingSession = await sessionService.getSession({
    appName: APP_NAME,
    userId,
    sessionId,
  });

  if (existingSession) {
    return existingSession;
  }

  return sessionService.createSession({
    appName: APP_NAME,
    userId,
    sessionId,
  });
};

export async function runFinanceAgent({
  messages = [],
  requestContext = {},
  systemPrompt = "",
}) {
  if (!ensureGeminiApiKey()) {
    return null;
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && message?.content)?.content;

  if (!lastUserMessage) {
    return null;
  }

  const { userId, sessionId } = getRequestIds(requestContext);
  await ensureSession({ userId, sessionId });

  await appendTrace({
    stage: "agent_run_start",
    userId,
    sessionId,
    promptPreview: lastUserMessage.slice(0, 180),
    hasSystemPrompt: Boolean(systemPrompt),
  });

  const agent = createFinanceAgent(requestContext);
  const runner = new Runner({
    appName: APP_NAME,
    agent,
    sessionService,
    memoryService,
  });

  let finalText = "";

  for await (const event of runner.runAsync({
    userId,
    sessionId,
    newMessage: createUserContent(lastUserMessage),
  })) {
    if (isFinalResponse(event)) {
      const parts = event.content?.parts || [];
      finalText += parts
        .map((part) => part?.text || "")
        .filter(Boolean)
        .join("");
    }
  }

  const trimmedText = finalText.trim();
  if (!trimmedText) {
    return null;
  }

  await appendTrace({
    stage: "agent_run_finish",
    userId,
    sessionId,
    responsePreview: trimmedText.slice(0, 240),
  });

  return buildTextAgenticResponse(trimmedText, "adk");
}
