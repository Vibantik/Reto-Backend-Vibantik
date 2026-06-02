const {
  getAllPresupuestos,
  getLatestPresupuesto,
} = require("../presupuestos.service");

const { getMetasByUser } = require("../metas.service");
const { getInversionesByUser } = require("../inversiones.service");

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeInvestmentType = (tipo = "Sin tipo") => {
  const normalized = String(tipo || "Sin tipo").trim();

  return normalized || "Sin tipo";
};

const pickActiveBudget = (presupuestos = [], now = new Date()) =>
  presupuestos.find((budget) => {
    const start = budget?.inicio ? new Date(budget.inicio) : null;
    const end = budget?.fin ? new Date(budget.fin) : null;

    return start && start <= now && (!end || end >= now);
  }) || null;

const compactBudget = (budget) => {
  if (!budget) return null;

  return {
    id: budget.id_presupuesto,
    nombre: budget.nombre,
    montoLimite: toNumber(budget.monto_limite),
    totalEjecutado: toNumber(budget.total_ejecutado),
    totalIngresos: toNumber(budget.total_ingresos),
    inicio: budget.inicio,
    fin: budget.fin,
    categorias: Array.isArray(budget.categorias)
      ? budget.categorias.map((category) => ({
          id: category.id_categ,
          nombre: category.nombre_categ,
          montoAsignado: toNumber(category.monto_asignado),
        }))
      : undefined,
  };
};

async function getBudgetSnapshot(uuid) {
  const presupuestos = await getAllPresupuestos(uuid);
  const latestBudget = await getLatestPresupuesto(uuid);
  const activeBudget = pickActiveBudget(presupuestos);

  return {
    totalBudgets: presupuestos.length,
    activeBudget: compactBudget(activeBudget),
    latestBudget: compactBudget(latestBudget),
    activeBudgetName: activeBudget?.nombre || null,
    activeBudgetBalance: activeBudget
      ? toNumber(activeBudget.monto_limite) - toNumber(activeBudget.total_ejecutado)
      : null,
  };
}

async function getGoalsSnapshot(uuid) {
  const metas = await getMetasByUser(uuid);

  const avgProgress = metas.length
    ? metas.reduce((sum, meta) => sum + toNumber(meta.progreso), 0) /
      metas.length
    : 0;

  return {
    totalGoals: metas.length,
    averageProgress: Number(avgProgress.toFixed(2)),
    goals: metas.slice(0, 5).map((meta) => ({
      id: meta.id_meta,
      titulo: meta.titulo,
      montoMeta: toNumber(meta.monto_meta),
      progreso: Number(toNumber(meta.progreso).toFixed(2)),
      fechaFin: meta.fecha_fin,
    })),
  };
}

const getInvestmentProfile = ({
  totalInvested,
  typeBreakdown,
  activeInvestments,
}) => {
  if (!totalInvested || !activeInvestments.length) {
    return {
      profile: "sin información suficiente",
      reason:
        "No hay inversiones activas suficientes para inferir un perfil inversionista.",
    };
  }

  const sortedTypes = [...typeBreakdown].sort(
    (a, b) => b.totalInvested - a.totalInvested
  );

  const mainType = sortedTypes[0];
  const mainShare = mainType?.percentage || 0;

  const hasVariableOrCrypto = sortedTypes.some((item) => {
    const type = item.tipo.toLowerCase();

    return (
      type.includes("accion") ||
      type.includes("acciones") ||
      type.includes("renta variable") ||
      type.includes("crypto") ||
      type.includes("cripto") ||
      type.includes("etf")
    );
  });

  const hasFixedIncome = sortedTypes.some((item) => {
    const type = item.tipo.toLowerCase();

    return (
      type.includes("cetes") ||
      type.includes("bono") ||
      type.includes("bonos") ||
      type.includes("renta fija") ||
      type.includes("fondo")
    );
  });

  if (hasVariableOrCrypto && mainShare >= 60) {
    return {
      profile: "agresivo",
      reason: `La mayor parte de tu inversión está concentrada en ${mainType.tipo}, que suele asociarse con mayor volatilidad.`,
    };
  }

  if (hasFixedIncome && mainShare >= 70) {
    return {
      profile: "conservador",
      reason: `La mayor parte de tu inversión está concentrada en ${mainType.tipo}, que suele asociarse con menor volatilidad.`,
    };
  }

  return {
    profile: "moderado",
    reason:
      "Tu inversión parece estar distribuida entre distintos tipos o no está excesivamente concentrada en activos de alto riesgo.",
  };
};

async function getInvestmentsSnapshot(uuid) {
  const inversiones = await getInversionesByUser(uuid);

  const now = new Date();
  const inThirtyDays = new Date();

  inThirtyDays.setDate(inThirtyDays.getDate() + 30);

  const activeInvestments = inversiones.filter(
    (investment) =>
      investment?.fecha_fin && new Date(investment.fecha_fin) > now
  );

  const totalInvested = activeInvestments.reduce(
    (sum, investment) => sum + toNumber(investment.valor),
    0
  );

  const typeTotalsMap = activeInvestments.reduce((acc, investment) => {
    const tipo = normalizeInvestmentType(investment.tipo);
    const current = acc.get(tipo) || {
      tipo,
      totalInvested: 0,
      count: 0,
    };

    current.totalInvested += toNumber(investment.valor);
    current.count += 1;

    acc.set(tipo, current);

    return acc;
  }, new Map());

  const typeBreakdown = [...typeTotalsMap.values()]
    .map((item) => ({
      ...item,
      percentage: totalInvested
        ? Number(((item.totalInvested / totalInvested) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => b.totalInvested - a.totalInvested);

  const topInvestmentType = typeBreakdown[0] || null;

  const maturingSoonList = activeInvestments
    .filter((investment) => new Date(investment.fecha_fin) <= inThirtyDays)
    .map((investment) => ({
      id: investment.id_inversión || investment.id_inversion,
      nombre: investment.nombre,
      valor: toNumber(investment.valor),
      tipo: investment.tipo,
      fechaFin: investment.fecha_fin,
    }));

  const profile = getInvestmentProfile({
    totalInvested,
    typeBreakdown,
    activeInvestments,
  });

  return {
    totalInvestments: inversiones.length,
    activeInvestments: activeInvestments.length,
    totalInvested,
    maturingSoon: maturingSoonList.length,
    maturingSoonList,
    topInvestmentType,
    typeBreakdown,
    investorProfile: profile.profile,
    investorProfileReason: profile.reason,
    investments: activeInvestments.slice(0, 10).map((investment) => ({
      id: investment.id_inversión || investment.id_inversion,
      nombre: investment.nombre,
      valor: toNumber(investment.valor),
      tipo: investment.tipo,
      fechaFin: investment.fecha_fin,
    })),
  };
}

async function getFinancialOverview(uuid) {
  const [budget, goals, investments] = await Promise.all([
    getBudgetSnapshot(uuid),
    getGoalsSnapshot(uuid),
    getInvestmentsSnapshot(uuid),
  ]);

  return {
    budget,
    goals,
    investments,
  };
}

module.exports = {
  getBudgetSnapshot,
  getGoalsSnapshot,
  getInvestmentsSnapshot,
  getFinancialOverview,
};