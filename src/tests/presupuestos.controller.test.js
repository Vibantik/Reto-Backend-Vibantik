/**
 Runner : Jest + Supertest
  CP-CA01 cubiertos:
    CP-10 (CA0110) – GET /api/presupuestos sin uuid → HTTP 400
  CP-CA02 cubiertos:
    CP-12 (CA0214) – POST /api/presupuestos sin uuid_de_usuario → HTTP 400
    CP-12 (CA0214) – POST /api/presupuestos con monto_limite ≤ 0    → HTTP 400
    CP-01 (CA0201) – POST /api/presupuestos con datos válidos        → HTTP 201
    CP-08 (CA0209) – DELETE /api/presupuestos/:id → HTTP 200 / 404
*/

const request = require("supertest");

// MOCK bd
jest.mock("../connect", () => ({
  query:   jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn().mockResolvedValue({
    query:   jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  }),
}));

// mock de categorias
jest.mock("../services/transactions_categorization.service", () => jest.fn());


// mocj presupuestos
jest.mock("../services/presupuestos.service", () => ({
  getAllPresupuestos:    jest.fn(),
  getLatestPresupuesto: jest.fn(),
  getPresupuestoById:   jest.fn(),
  createPresupuesto:    jest.fn(),
  updatePresupuesto:    jest.fn(),
  deletePresupuesto:    jest.fn(),
  vincularTransaccion:  jest.fn(),
}));


const presupuestosService = require("../services/presupuestos.service");
const app = require("../app");

//  HU-01 – CP-10 (CA0110)
//  Prueba de contrato API: GET /api/presupuestos sin uuid → 400
describe("HU-01 | CP-10 (CA0110) – GET /api/presupuestos sin uuid", () => {
  test("responde HTTP 400 y mensaje de error cuando no se envía uuid", async () => {
    const res = await request(app).get("/api/presupuestos");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message.toLowerCase()).toMatch(/uuid/);
  });

  test("responde HTTP 200 y arreglo cuando uuid es válido", async () => {
    presupuestosService.getAllPresupuestos.mockResolvedValue([
      { id_presupuesto: 1, nombre: "Mayo", monto_limite: 5000 },
    ]);

    const res = await request(app).get(
      "/api/presupuestos?uuid=test-uuid-1234"
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });
});

describe("HU-01 | Contexto del wizard – GET /api/presupuestos/last-month", () => {
  test("responde HTTP 400 cuando falta uuid", async () => {
    const res = await request(app).get("/api/presupuestos/last-month");

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toMatch(/uuid/);
  });

  test("responde HTTP 404 cuando no existe presupuesto previo", async () => {
    presupuestosService.getLatestPresupuesto.mockResolvedValue(null);

    const res = await request(app).get(
      "/api/presupuestos/last-month?uuid=test-uuid-1234"
    );

    expect(res.status).toBe(404);
  });

  test("responde HTTP 200 con el ultimo presupuesto cuando existe", async () => {
    presupuestosService.getLatestPresupuesto.mockResolvedValue({
      id_presupuesto: 8,
      nombre: "Abril",
      monto_limite: 3500,
      categorias: [],
      transacciones: [],
    });

    const res = await request(app).get(
      "/api/presupuestos/last-month?uuid=test-uuid-1234"
    );

    expect(res.status).toBe(200);
    expect(res.body.id_presupuesto).toBe(8);
  });
});

//  HU-02 | CP-12 (CA0214)
//  Prueba de contrato API: POST /api/presupuestos con payload inválido → 400
describe("HU-02 | CP-12 (CA0214) – POST /api/presupuestos validación de entrada", () => {
  test("responde HTTP 400 cuando falta uuid_de_usuario", async () => {
    const res = await request(app)
      .post("/api/presupuestos")
      .send({ nombre: "Test", monto_limite: 1000, inicio: "2026-06-01" });

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toMatch(/uuid/);
  });

  test("responde HTTP 400 cuando monto_limite = 0", async () => {
    const res = await request(app)
      .post("/api/presupuestos")
      .send({ uuid_de_usuario: "uuid-test", nombre: "Test", monto_limite: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toMatch(/monto/);
  });

  test("responde HTTP 400 cuando monto_limite es negativo", async () => {
    const res = await request(app)
      .post("/api/presupuestos")
      .send({ uuid_de_usuario: "uuid-test", nombre: "Test", monto_limite: -50 });

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toMatch(/monto/);
  });

  test("responde HTTP 400 cuando nombre está vacío", async () => {
    const res = await request(app)
      .post("/api/presupuestos")
      .send({ uuid_de_usuario: "uuid-test", nombre: "   ", monto_limite: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toMatch(/nombre/);
  });
});

//  HU-02 | CP-01 (CA0201/CA0202)
//  Funcional: POST /api/presupuestos con datos válidos → 201
describe("HU-02 | CP-01 (CA0201/CA0202) – POST /api/presupuestos creación exitosa", () => {
  test("responde HTTP 201 con datos del presupuesto creado", async () => {
    const mockPresupuesto = {
      id_presupuesto: 42,
      nombre: "Test",
      monto_limite: 1000,
      inicio: "2026-06-01",
      fin: "2026-06-30",
      categorias: [],
      transacciones: [],
    };
    presupuestosService.createPresupuesto.mockResolvedValue(mockPresupuesto);

    const res = await request(app)
      .post("/api/presupuestos")
      .send({
        uuid_de_usuario: "uuid-test",
        nombre: "Test",
        monto_limite: 1000,
        inicio: "2026-06-01",
        fin: "2026-06-30",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id_presupuesto");
    expect(res.body.nombre).toBe("Test");
  });
});

//  HU-02 | CP-08 (CA0209/CA0210)
//  Funcional: DELETE /api/presupuestos/:id
describe("HU-02 | CP-08 (CA0209/CA0210) – DELETE /api/presupuestos/:id", () => {
  test("responde HTTP 200 cuando el presupuesto existe y se elimina", async () => {
    presupuestosService.deletePresupuesto.mockResolvedValue(true);

    const res = await request(app).delete("/api/presupuestos/1");

    expect(res.status).toBe(200);
    expect(res.body.message.toLowerCase()).toMatch(/eliminado/);
  });

  test("responde HTTP 404 cuando el presupuesto no existe", async () => {
    presupuestosService.deletePresupuesto.mockResolvedValue(false);

    const res = await request(app).delete("/api/presupuestos/9999");

    expect(res.status).toBe(404);
  });
});

//  HU-02 | CP-07 (CA0207/CA0208)
//  Funcional: PUT /api/presupuestos/:id actualización
describe("HU-02 | CP-07 (CA0207/CA0208) – PUT /api/presupuestos/:id actualización", () => {
  test("responde HTTP 200 con presupuesto actualizado cuando existe", async () => {
    const mockActualizado = {
      id_presupuesto: 1,
      nombre: "Mayo Actualizado",
      monto_limite: 6500,
      categorias: [],
      transacciones: [],
    };
    presupuestosService.updatePresupuesto.mockResolvedValue(mockActualizado);

    const res = await request(app)
      .put("/api/presupuestos/1")
      .send({ nombre: "Mayo Actualizado", monto_limite: 6500 });

    expect(res.status).toBe(200);
    expect(res.body.monto_limite).toBe(6500);
  });

  test("responde HTTP 404 cuando el presupuesto a actualizar no existe", async () => {
    presupuestosService.updatePresupuesto.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/presupuestos/9999")
      .send({ nombre: "No existe" });

    expect(res.status).toBe(404);
  });
});
