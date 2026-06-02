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

const formatPercentage = (value) => Number(Number(value || 0).toFixed(2));

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

const getDaysUntil = (dateValue) => {
  if (!dateValue) return null;

  const today = new Date();
  const target = new Date(dateValue);

  if (Number.isNaN(target.getTime())) return null;

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = target.getTime() - today.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const getRiskBucketFromType = (tipo = "") => {
  const normalized = normalizeInvestmentType(tipo).toLowerCase();

  if (
    normalized.includes("cetes") ||
    normalized.includes("pagar") ||
    normalized.includes("pagaré") ||
    normalized.includes("plazo") ||
    normalized.includes("bono") ||
    normalized.includes("renta fija")
  ) {
    return "bajo";
  }

  if (
    normalized.includes("fondo") ||
    normalized.includes("etf") ||
    normalized.includes("mixto") ||
    normalized.includes("balanceado")
  ) {
    return "medio";
  }

  if (
    normalized.includes("accion") ||
    normalized.includes("acciones") ||
    normalized.includes("cripto") ||
    normalized.includes("crypto") ||
    normalized.includes("renta variable")
  ) {
    return "alto";
  }

  return "no clasificado";
};

const inferInvestorProfile = ({ totalInvested, typeBreakdown, riskBreakdown }) => {
  if (!totalInvested || !typeBreakdown.length) {
    return {
      profile: "sin información suficiente",
      reason:
        "No hay suficientes inversiones activas para inferir un perfil inversionista.",
    };
  }

  const lowRisk = riskBreakdown.find((item) => item.risk === "bajo")?.percentage || 0;
  const mediumRisk =
    riskBreakdown.find((item) => item.risk === "medio")?.percentage || 0;
  const highRisk = riskBreakdown.find((item) => item.risk === "alto")?.percentage || 0;

  const topType = typeBreakdown[0];
  const concentration = topType?.percentage || 0;

  if (lowRisk >= 70) {
    return {
      profile: "conservador",
      reason: `Aproximadamente ${lowRisk}% de tu capital activo está en instrumentos clasificados como riesgo bajo.`,
    };
  }

  if (highRisk >= 50) {
    return {
      profile: "agresivo",
      reason: `Aproximadamente ${highRisk}% de tu capital activo está en instrumentos clasificados como riesgo alto.`,
    };
  }

  if (concentration >= 75) {
    return {
      profile: "concentrado",
      reason: `Tienes ${concentration}% de tu capital activo concentrado en ${topType.tipo}.`,
    };
  }

  if (mediumRisk >= 40 || (lowRisk > 0 && highRisk > 0)) {
    return {
      profile: "moderado",
      reason:
        "Tu capital activo parece estar distribuido entre instrumentos de distintos niveles de riesgo.",
    };
  }

  return {
    profile: "moderado",
    reason:
      "No se observa una concentración dominante de alto riesgo ni una cartera completamente conservadora.",
  };
};

async function getInvestmentsSnapshot(uuid) {
  const inversiones = await getInversionesByUser(uuid);

  const now = new Date();
  const inThirtyDays = new Date();

  inThirtyDays.setDate(inThirtyDays.getDate() + 30);

  const normalizedInvestments = inversiones.map((investment) => {
    const tipo = normalizeInvestmentType(investment.tipo);
    const valor = toNumber(investment.valor);
    const fechaFin = investment.fecha_fin;
    const daysUntilMaturity = getDaysUntil(fechaFin);
    const riskBucket = getRiskBucketFromType(tipo);

    return {
      id: investment.id_inversión || investment.id_inversion,
      nombre: investment.nombre,
      valor,
      tipo,
      fechaInicio: investment.fecha_inicio,
      fechaFin,
      daysUntilMaturity,
      riskBucket,
      isActive: fechaFin ? new Date(fechaFin) > now : true,
    };
  });

  const activeInvestments = normalizedInvestments.filter(
    (investment) => investment.isActive
  );

  const totalInvested = activeInvestments.reduce(
    (sum, investment) => sum + investment.valor,
    0
  );

  const typeTotals = activeInvestments.reduce((acc, investment) => {
    const current = acc.get(investment.tipo) || {
      tipo: investment.tipo,
      totalInvested: 0,
      count: 0,
    };

    current.totalInvested += investment.valor;
    current.count += 1;

    acc.set(investment.tipo, current);

    return acc;
  }, new Map());

  const typeBreakdown = [...typeTotals.values()]
    .map((item) => ({
      ...item,
      percentage: totalInvested
        ? formatPercentage((item.totalInvested / totalInvested) * 100)
        : 0,
    }))
    .sort((a, b) => b.totalInvested - a.totalInvested);

  const riskTotals = activeInvestments.reduce((acc, investment) => {
    const current = acc.get(investment.riskBucket) || {
      risk: investment.riskBucket,
      totalInvested: 0,
      count: 0,
    };

    current.totalInvested += investment.valor;
    current.count += 1;

    acc.set(investment.riskBucket, current);

    return acc;
  }, new Map());

  const riskBreakdown = [...riskTotals.values()]
    .map((item) => ({
      ...item,
      percentage: totalInvested
        ? formatPercentage((item.totalInvested / totalInvested) * 100)
        : 0,
    }))
    .sort((a, b) => b.totalInvested - a.totalInvested);

  const topInvestmentType = typeBreakdown[0] || null;

  const biggestInvestment =
    [...activeInvestments].sort((a, b) => b.valor - a.valor)[0] || null;

  const maturingSoonList = activeInvestments
    .filter((investment) => {
      if (investment.daysUntilMaturity === null) return false;
      return investment.daysUntilMaturity >= 0 && investment.daysUntilMaturity <= 30;
    })
    .sort((a, b) => a.daysUntilMaturity - b.daysUntilMaturity);

  const concentrationWarnings = [];

  if (topInvestmentType?.percentage >= 70) {
    concentrationWarnings.push(
      `Alta concentración por tipo: ${topInvestmentType.percentage}% está en ${topInvestmentType.tipo}.`
    );
  }

  if (biggestInvestment && totalInvested) {
    const biggestShare = formatPercentage(
      (biggestInvestment.valor / totalInvested) * 100
    );

    if (biggestShare >= 50) {
      concentrationWarnings.push(
        `Alta concentración individual: ${biggestShare}% está en ${biggestInvestment.nombre}.`
      );
    }
  }

  const investorProfile = inferInvestorProfile({
    totalInvested,
    typeBreakdown,
    riskBreakdown,
  });

  return {
    totalInvestments: inversiones.length,
    activeInvestments: activeInvestments.length,
    totalInvested,
    topInvestmentType,
    biggestInvestment,
    typeBreakdown,
    riskBreakdown,
    investorProfile: investorProfile.profile,
    investorProfileReason: investorProfile.reason,
    concentrationWarnings,
    maturingSoon: maturingSoonList.length,
    maturingSoonList: maturingSoonList.slice(0, 10),
    investments: activeInvestments.slice(0, 10),
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