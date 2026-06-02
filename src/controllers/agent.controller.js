const { executeAgentAction } = require("../services/agentic/agent-actions.service");

const executeAction = async (req, res) => {
  try {
    const result = await executeAgentAction(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error al ejecutar accion agentic:", error.message || error);
    return res.status(error.status || 500).json({
      type: "action_result",
      success: false,
      message: error.message || "Error interno del servidor",
    });
  }
};

module.exports = {
  executeAction,
};
