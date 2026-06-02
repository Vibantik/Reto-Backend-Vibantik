const { randomUUID } = require("crypto");
const {
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
} = require("../presupuestos.service");
const {
  getMetasByUser,
  addMeta,
  updateMetaById,
  deleteMetaById,
} = require("../metas.service");

const TOKEN_TTL_MS = 5 * 60 * 1000;
const pendingActions = new Map();

const ACTIONS = {
  crear_meta: { module: "metas", label: "crear una meta" },
  actualizar_meta: { module: "metas", label: "actualizar una meta" },
  eliminar_meta: { module: "metas", label: "eliminar una meta" },
  crear_presupuesto: { module: "presupuestos", label: "crear un presupuesto" },
  actualizar_presupuesto: { module: "presupuestos", label: "actualizar un presupuesto" },
  eliminar_presupuesto: { module: "presupuestos", label: "eliminar un presupuesto" },
};

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toNumber = (value) => {
  const normalized = String(value ?? "")
    .replace(/[,$\s]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const parseAmount = (text = "") => {
  const matches = text.matchAll(/\$?\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:[.,]\d{1,2})?/g);

  for (const match of matches) {
    const start = match.index || 0;
    const end = start + match[0].length;
    const before = normalizeText(text.slice(Math.max(0, start - 4), start));
    const after = normalizeText(text.slice(end, end + 12));

    if (before.endsWith("en ") || /^\s*(dias?|mes(?:es)?)\b/.test(after)) {
      continue;
    }

    return toNumber(match[0]);
  }

  return null;
};

const parseId = (text = "") => {
  const match = normalizeText(text).match(/\b(?:id|meta|presupuesto)\s*#?\s*(\d+)\b/);
  return match ? Number(match[1]) : null;
};

const parseDurationDays = (text = "") => {
  const normalized = normalizeText(text);
  const days = normalized.match(/\b(?:en|durante|por)\s+(\d{1,4})\s*dias?\b/);
  if (days) return Number(days[1]);

  const months = normalized.match(/\b(?:en|durante|por)\s+(\d{1,3})\s*mes(?:es)?\b/);
  if (months) return Number(months[1]) * 30;

  return null;
};

const parseNameAfterPara = (text = "", fallback = "") => {
  const match = text.match(/\bpara\s+(.+?)(?:\s+en\s+\d|\s+de\s+\$?\d|\s+por\s+\$?\d|$)/i);
  const value = match?.[1]?.trim();
  if (!value) return fallback;
  return value.replace(/[.?!]+$/, "").slice(0, 80);
};

const hasActionVerb = (normalized) =>
  /\b(crea|crear|agrega|agregar|haz|hacer|actualiza|actualizar|cambia|cambiar|modifica|modificar|elimina|eliminar|borra|borrar)\b/.test(
    normalized
  );

const createAgentError = (message, missingFields = []) => ({
  type: "agent_error",
  content: message,
  message,
  missingFields,
});

const pruneExpiredActions = () => {
  const now = Date.now();
  for (const [token, action] of pendingActions.entries()) {
    if (action.expiresAt <= now) {
      pendingActions.delete(token);
    }
  }
};

const createActionProposal = ({ tool, uuidDeUsuario, params, message }) => {
  pruneExpiredActions();

  const action = ACTIONS[tool];
  if (!action) {
    throw new Error(`Accion agentic no permitida: ${tool}`);
  }

  const token = randomUUID();
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  pendingActions.set(token, {
    tool,
    uuidDeUsuario,
    params,
    expiresAt,
  });

  return {
    type: "action_proposal",
    data: {
      tool,
      module: action.module,
      message,
      params,
      confirmation_token: token,
      expires_at: new Date(expiresAt).toISOString(),
    },
  };
};

const buildCreateMetaProposal = (text, uuidDeUsuario) => {
  const monto = parseAmount(text);
  const plazoDias = parseDurationDays(text);

  if (!monto || !plazoDias) {
    return null;
  }

  const fechaInicio = toIsoDate(new Date());
  const fechaFin = toIsoDate(addDays(new Date(), plazoDias));
  const nombreMeta = parseNameAfterPara(text, "Nueva meta de ahorro");

  return createActionProposal({
    tool: "crear_meta",
    uuidDeUsuario,
    message: `Puedo crear la meta "${nombreMeta}" por $${monto.toLocaleString("es-MX")} MXN. Confirma para guardarla.`,
    params: {
      nombreMeta,
      monto_meta: monto,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      plazo_dias: plazoDias,
    },
  });
};

const buildCreateBudgetProposal = (text, uuidDeUsuario) => {
  const montoLimite = parseAmount(text);

  if (!montoLimite) {
    return null;
  }

  const nombre = parseNameAfterPara(text, "Presupuesto creado por Aura");
  const inicio = toIsoDate(new Date());

  return createActionProposal({
    tool: "crear_presupuesto",
    uuidDeUsuario,
    message: `Puedo crear el presupuesto "${nombre}" con limite de $${montoLimite.toLocaleString("es-MX")} MXN. Confirma para guardarlo.`,
    params: {
      nombre,
      monto_limite: montoLimite,
      inicio,
      fin: "",
      categorias: [],
    },
  });
};

const buildUpdateOrDeleteProposal = (text, normalized, uuidDeUsuario) => {
  const id = parseId(text);
  const isMeta = /\bmeta|metas\b/.test(normalized);
  const isBudget = /\bpresupuesto|presupuestos\b/.test(normalized);
  const isDelete = /\b(elimina|eliminar|borra|borrar)\b/.test(normalized);
  const isUpdate = /\b(actualiza|actualizar|cambia|cambiar|modifica|modificar)\b/.test(normalized);
  const amount = parseAmount(text);

  if (!id || (!isDelete && !amount)) return null;

  if (isMeta && isDelete) {
    return createActionProposal({
      tool: "eliminar_meta",
      uuidDeUsuario,
      message: `Puedo eliminar la meta ${id}. Confirma solo si estas seguro.`,
      params: { id_meta: id },
    });
  }

  if (isBudget && isDelete) {
    return createActionProposal({
      tool: "eliminar_presupuesto",
      uuidDeUsuario,
      message: `Puedo eliminar el presupuesto ${id}. Confirma solo si estas seguro.`,
      params: { id_presupuesto: id },
    });
  }

  if (isMeta && isUpdate) {
    return createActionProposal({
      tool: "actualizar_meta",
      uuidDeUsuario,
      message: `Puedo actualizar la meta ${id}. Revisa los datos antes de confirmar.`,
      params: { id_meta: id, monto_meta: amount },
    });
  }

  if (isBudget && isUpdate) {
    return createActionProposal({
      tool: "actualizar_presupuesto",
      uuidDeUsuario,
      message: `Puedo actualizar el presupuesto ${id}. Revisa los datos antes de confirmar.`,
      params: { id_presupuesto: id, monto_limite: amount },
    });
  }

  return null;
};

const planConfirmableAction = (messages = [], requestContext = {}) => {
  const text = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && message?.content)?.content;

  if (!text) return null;

  const normalized = normalizeText(text);
  const isMeta = /\bmeta|metas|ahorro\b/.test(normalized);
  const isBudget = /\bpresupuesto|presupuestos\b/.test(normalized);

  if (!hasActionVerb(normalized) || (!isMeta && !isBudget)) {
    return null;
  }

  const id = parseId(text);
  const amount = parseAmount(text);
  const durationDays = parseDurationDays(text);
  const isDelete = /\b(elimina|eliminar|borra|borrar)\b/.test(normalized);
  const isUpdate = /\b(actualiza|actualizar|cambia|cambiar|modifica|modificar)\b/.test(normalized);
  const isCreate = /\b(crea|crear|agrega|agregar|haz|hacer)\b/.test(normalized);
  const hasExecutableShape =
    (isCreate && isMeta && amount && durationDays) ||
    (isCreate && isBudget && amount) ||
    ((isUpdate || isDelete) && id && (isDelete || amount));

  if (!requestContext.userUuid && hasExecutableShape) {
    return createAgentError(
      "Necesito identificar al usuario antes de proponer acciones.",
      ["uuid_de_usuario"]
    );
  }

  if (!requestContext.userUuid) {
    return null;
  }

  const updateOrDeleteProposal = buildUpdateOrDeleteProposal(
    text,
    normalized,
    requestContext.userUuid
  );
  if (updateOrDeleteProposal) return updateOrDeleteProposal;

  if (/\b(crea|crear|agrega|agregar|haz|hacer)\b/.test(normalized)) {
    if (isMeta) {
      return buildCreateMetaProposal(text, requestContext.userUuid);
    }

    if (isBudget) {
      return buildCreateBudgetProposal(text, requestContext.userUuid);
    }
  }

  return null;
};

const ensureToken = (token) => {
  pruneExpiredActions();

  const pending = pendingActions.get(token);
  if (!pending) {
    const error = new Error("Token de confirmacion invalido o expirado");
    error.status = 404;
    throw error;
  }

  return pending;
};

const requireNumber = (value, field) => {
  const parsed = toNumber(value);
  if (!parsed || parsed <= 0) {
    const error = new Error(`${field} debe ser mayor a 0`);
    error.status = 400;
    throw error;
  }
  return parsed;
};

const executeMetaAction = async (tool, uuidDeUsuario, params) => {
  if (tool === "crear_meta") {
    return addMeta({
      uuidDeUsuario,
      nombreMeta: String(params.nombreMeta || params.nombre_meta || "").trim(),
      montoMeta: requireNumber(params.monto_meta ?? params.monto, "monto_meta"),
      fechaInicio: params.fecha_inicio,
      fechaFin: params.fecha_fin,
      plazoDias: requireNumber(params.plazo_dias, "plazo_dias"),
    });
  }

  if (tool === "actualizar_meta") {
    const idMeta = requireNumber(params.id_meta, "id_meta");
    const currentMeta = (await getMetasByUser(uuidDeUsuario)).find(
      (meta) => Number(meta.id_meta) === Number(idMeta)
    );

    if (!currentMeta) {
      const error = new Error("Meta no encontrada");
      error.status = 404;
      throw error;
    }

    return updateMetaById({
      idMeta,
      uuidDeUsuario,
      nombreMeta:
        params.nombreMeta ||
        params.nombre_meta ||
        currentMeta.nombreMeta ||
        currentMeta.titulo,
      montoMeta: requireNumber(params.monto_meta ?? params.monto, "monto_meta"),
      fechaInicio: params.fecha_inicio || currentMeta.fecha_inicio,
      fechaFin: params.fecha_fin || currentMeta.fecha_fin,
      plazoDias: requireNumber(params.plazo_dias || currentMeta.plazo_dias, "plazo_dias"),
    });
  }

  if (tool === "eliminar_meta") {
    return deleteMetaById({
      idMeta: requireNumber(params.id_meta, "id_meta"),
      uuidDeUsuario,
    });
  }

  throw new Error(`Accion de meta no soportada: ${tool}`);
};

const executeBudgetAction = async (tool, uuidDeUsuario, params) => {
  if (tool === "crear_presupuesto") {
    return createPresupuesto(uuidDeUsuario, {
      nombre: String(params.nombre || "").trim(),
      monto_limite: requireNumber(params.monto_limite ?? params.monto, "monto_limite"),
      ["descripciÃ³n"]: params["descripciÃ³n"] || params.descripcion || "",
      inicio: params.inicio || toIsoDate(new Date()),
      fin: params.fin || null,
      categorias: Array.isArray(params.categorias) ? params.categorias : [],
    });
  }

  if (tool === "actualizar_presupuesto") {
    return updatePresupuesto(requireNumber(params.id_presupuesto, "id_presupuesto"), {
      ...params,
      monto_limite:
        params.monto_limite !== undefined || params.monto !== undefined
          ? requireNumber(params.monto_limite ?? params.monto, "monto_limite")
          : undefined,
    });
  }

  if (tool === "eliminar_presupuesto") {
    return deletePresupuesto(requireNumber(params.id_presupuesto, "id_presupuesto"));
  }

  throw new Error(`Accion de presupuesto no soportada: ${tool}`);
};

const executeAgentAction = async ({
  confirmation_token,
  uuid_de_usuario,
  confirmed,
  params = {},
}) => {
  if (!confirmation_token) {
    const error = new Error("confirmation_token es requerido");
    error.status = 400;
    throw error;
  }

  const pending = ensureToken(confirmation_token);

  if (!confirmed) {
    pendingActions.delete(confirmation_token);
    return {
      type: "action_result",
      success: true,
      tool: pending.tool,
      module: ACTIONS[pending.tool].module,
      message: "Accion cancelada. No hice cambios.",
      result: null,
    };
  }

  if (!uuid_de_usuario || uuid_de_usuario !== pending.uuidDeUsuario) {
    const error = new Error("El usuario no coincide con la accion propuesta");
    error.status = 403;
    throw error;
  }

  const mergedParams = {
    ...pending.params,
    ...params,
  };

  const action = ACTIONS[pending.tool];
  let result;

  if (action.module === "metas") {
    result = await executeMetaAction(pending.tool, uuid_de_usuario, mergedParams);
  } else if (action.module === "presupuestos") {
    result = await executeBudgetAction(pending.tool, uuid_de_usuario, mergedParams);
  } else {
    throw new Error(`Modulo no soportado: ${action.module}`);
  }

  pendingActions.delete(confirmation_token);

  return {
    type: "action_result",
    success: true,
    tool: pending.tool,
    module: action.module,
    message: `Listo, pude ${action.label}.`,
    result,
  };
};

const __resetPendingActionsForTests = () => pendingActions.clear();

module.exports = {
  ACTIONS,
  TOKEN_TTL_MS,
  createActionProposal,
  executeAgentAction,
  planConfirmableAction,
  __resetPendingActionsForTests,
};
