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
  try {
    const adkRuntime = await loadAdkRuntimeModule();
    return await adkRuntime.runFinanceAgent(input);
  } catch (error) {
    if (isMissingOptionalDependencyError(error)) {
      console.warn(
        "ADK runtime is not available yet. Falling back to the legacy agentic flow."
      );
      return null;
    }

    throw error;
  }
};

module.exports = {
  runFinanceAgentRuntime,
};
