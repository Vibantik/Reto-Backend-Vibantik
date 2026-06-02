const path = require("path");
const { pathToFileURL } = require("url");

let adkModulePromise;

const loadAdkRuntimeModule = () => {
  if (!adkModulePromise) {
    const moduleUrl = pathToFileURL(
      path.join(__dirname, "finance-agent-runtime.mjs")
    ).href;
    adkModulePromise = import(moduleUrl);
  }

  return adkModulePromise;
};

const isMissingOptionalDependencyError = (error) => {
  const message = String(error?.message || "");

  return (
    error?.code === "ERR_MODULE_NOT_FOUND" ||
    message.includes("@google/adk") ||
    message.includes("@google/genai") ||
    message.includes("zod")
  );
};

const runFinanceAgentRuntime = async (input) => {
  console.log("[runFinanceAgentRuntime] loading ADK module...");
  try {
    const adkRuntime = await loadAdkRuntimeModule();
    console.log("[runFinanceAgentRuntime] ADK module loaded, calling runFinanceAgent...");
    const result = await adkRuntime.runFinanceAgent(input);
    console.log("[runFinanceAgentRuntime] runFinanceAgent returned:", result ? `type=${result.type}` : "null/undefined");
    return result;
  } catch (error) {
    if (isMissingOptionalDependencyError(error)) {
      console.warn(
        "[runFinanceAgentRuntime] ADK runtime is not available (missing dependency). code=" +
          error.code + " message=" + error.message
      );
      return null;
    }

    console.error("[runFinanceAgentRuntime] unexpected error:", error.message || error);
    throw error;
  }
};

module.exports = {
  runFinanceAgentRuntime,
};
