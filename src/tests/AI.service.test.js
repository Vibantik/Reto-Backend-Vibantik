jest.mock("../connect", () => ({
  query: jest.fn(),
}));

const loadAIService = () => require("../services/AI.service");

describe("AI.service | planAgenticResponse", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  test("devuelve un ui_tool cuando el usuario pide planear presupuesto", async () => {
    const { planAgenticResponse } = loadAIService();

    const result = await planAgenticResponse([
      { role: "user", content: "Ayudame a planear mi presupuesto de comida para ahorrar 15%" },
    ]);

    expect(result).toMatchObject({
      type: "ui_tool",
      tool: "generate_budget_wizard",
      data: {
        intent: "increase_savings",
        categoryHint: "comida",
        savingsGoalPercent: 15,
        source: "heuristic",
      },
    });
  });

  test("no devuelve tool cuando la consulta no es de presupuesto", async () => {
    const { planAgenticResponse } = loadAIService();

    const result = await planAgenticResponse([
      { role: "user", content: "Explicame que es un fondo indexado" },
    ]);

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("usa Gemini solamente para routing de UI generativa cuando hay API key", async () => {
    process.env.GEMINI_API = "test-gemini-key";
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "generate_budget_wizard",
                    args: {
                      intent: "reduce_expenses",
                      categoryHint: "transporte",
                      savingsGoalPercent: 20,
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    const { planAgenticResponse } = loadAIService();
    const result = await planAgenticResponse([
      { role: "user", content: "Quiero reducir mi presupuesto de transporte 20%" },
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
    expect(result).toMatchObject({
      type: "ui_tool",
      tool: "generate_budget_wizard",
      data: {
        intent: "reduce_expenses",
        categoryHint: "transporte",
        savingsGoalPercent: 20,
        source: "gemini",
      },
    });
  });

  test("si Gemini falla conserva el fallback local del widget", async () => {
    process.env.GEMINI_API = "test-gemini-key";
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
    });

    const { planAgenticResponse } = loadAIService();
    const result = await planAgenticResponse([
      { role: "user", content: "Ayudame con mi presupuesto de comida" },
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      type: "ui_tool",
      tool: "generate_budget_wizard",
      data: {
        categoryHint: "comida",
        source: "heuristic",
      },
    });
  });
});
