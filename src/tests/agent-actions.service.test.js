jest.mock("../services/metas.service", () => ({
  getMetasByUser: jest.fn(),
  addMeta: jest.fn(),
  updateMetaById: jest.fn(),
  deleteMetaById: jest.fn(),
}));

jest.mock("../services/presupuestos.service", () => ({
  createPresupuesto: jest.fn(),
  updatePresupuesto: jest.fn(),
  deletePresupuesto: jest.fn(),
}));

const metasService = require("../services/metas.service");
const presupuestosService = require("../services/presupuestos.service");
const agentActions = require("../services/agentic/agent-actions.service");

describe("agent-actions.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    agentActions.__resetPendingActionsForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("crea una propuesta con token para una meta con datos suficientes", () => {
    const { planConfirmableAction } = agentActions;

    const proposal = planConfirmableAction(
      [
        {
          role: "user",
          content: "crea una meta de ahorro de 5000 para vacaciones en 90 dias",
        },
      ],
      { userUuid: "user-1" }
    );

    expect(proposal).toMatchObject({
      type: "action_proposal",
      data: {
        tool: "crear_meta",
        module: "metas",
        params: {
          nombreMeta: "vacaciones",
          monto_meta: 5000,
          plazo_dias: 90,
        },
      },
    });
    expect(proposal.data.confirmation_token).toEqual(expect.any(String));
    expect(proposal.data.expires_at).toEqual(expect.any(String));
  });

  test("ejecuta una meta confirmada con token valido", async () => {
    metasService.addMeta.mockResolvedValue({
      id_meta: 7,
      nombreMeta: "vacaciones",
      monto_meta: 5000,
    });

    const { executeAgentAction, planConfirmableAction } = agentActions;
    const proposal = planConfirmableAction(
      [
        {
          role: "user",
          content: "crea una meta de ahorro de 5000 para vacaciones en 90 dias",
        },
      ],
      { userUuid: "user-1" }
    );

    const result = await executeAgentAction({
      confirmation_token: proposal.data.confirmation_token,
      uuid_de_usuario: "user-1",
      confirmed: true,
      params: proposal.data.params,
    });

    expect(metasService.addMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        uuidDeUsuario: "user-1",
        nombreMeta: "vacaciones",
        montoMeta: 5000,
        plazoDias: 90,
      })
    );
    expect(result).toMatchObject({
      type: "action_result",
      success: true,
      tool: "crear_meta",
      module: "metas",
      result: {
        id_meta: 7,
      },
    });
  });

  test("cancela una accion sin ejecutar escritura", async () => {
    const { executeAgentAction, planConfirmableAction } = agentActions;
    const proposal = planConfirmableAction(
      [{ role: "user", content: "crea presupuesto de 12000 para junio" }],
      { userUuid: "user-1" }
    );

    const result = await executeAgentAction({
      confirmation_token: proposal.data.confirmation_token,
      uuid_de_usuario: "user-1",
      confirmed: false,
    });

    expect(presupuestosService.createPresupuesto).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: "action_result",
      success: true,
      tool: "crear_presupuesto",
      message: "Accion cancelada. No hice cambios.",
    });
  });

  test("rechaza token invalido", async () => {
    const { executeAgentAction } = agentActions;

    await expect(
      executeAgentAction({
        confirmation_token: "no-existe",
        uuid_de_usuario: "user-1",
        confirmed: true,
      })
    ).rejects.toMatchObject({
      status: 404,
      message: "Token de confirmacion invalido o expirado",
    });
  });

  test("rechaza token expirado", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000);
    const { TOKEN_TTL_MS, executeAgentAction, planConfirmableAction } = agentActions;
    const proposal = planConfirmableAction(
      [{ role: "user", content: "crea presupuesto de 12000 para junio" }],
      { userUuid: "user-1" }
    );

    nowSpy.mockReturnValue(1_000 + TOKEN_TTL_MS + 1);

    await expect(
      executeAgentAction({
        confirmation_token: proposal.data.confirmation_token,
        uuid_de_usuario: "user-1",
        confirmed: true,
      })
    ).rejects.toMatchObject({
      status: 404,
      message: "Token de confirmacion invalido o expirado",
    });
  });
});
