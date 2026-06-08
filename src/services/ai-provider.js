const { Readable } = require("stream");


function getProvider() {
  return (process.env.AI_PROVIDER || "ollama").toLowerCase();
}

function toGeminiContents(messages) {
  const systemParts = [];
  const contents = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  return { systemInstruction: systemParts.join("\n"), contents };
}

async function chat(messages, opts = {}) {
  const provider = getProvider();

  if (provider === "gemini") {
    return _geminiChat(messages, opts);
  }
  try {
    return await _ollamaChat(messages, opts);
  } catch (err) {
    if (process.env.GEMINI_API_KEY) {
      console.warn("[chat] Ollama unavailable, falling back to Gemini:", err.message);
      return _geminiChat(messages, opts);
    }
    throw err;
  }
}

async function _ollamaChat(messages, opts) {
  const url = (process.env.OLLAMA_URL || "http://localhost:11434/") + "api/chat";
  const model = opts.model || process.env.MODEL || process.env.OLLAMA_MODEL;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...opts.ollamaExtra,
    }),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.message?.content || "";
}

async function _geminiChat(messages, opts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = opts.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const { systemInstruction, contents } = toGeminiContents(messages);

  const body = { contents };
  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }
  if (opts.generationConfig) {
    body.generationConfig = opts.generationConfig;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini error: ${res.status} – ${errBody}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function chatStream(messages, res, opts = {}) {
  const provider = getProvider();

  if (provider === "gemini") {
    return _geminiChatStream(messages, res, opts);
  }
  try {
    return await _ollamaChatStream(messages, res, opts);
  } catch (err) {
    if (process.env.GEMINI_API_KEY && !res.headersSent) {
      console.warn("[chatStream] Ollama unavailable, falling back to Gemini:", err.message);
      return _geminiChatStream(messages, res, opts);
    }
    throw err;
  }
}

async function _ollamaChatStream(messages, res, opts) {
  const url = (process.env.OLLAMA_URL || "http://localhost:11434/") + "api/chat";
  const model = opts.model || process.env.MODEL || process.env.OLLAMA_MODEL;

  const ollamaRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      think: true,
      ...opts.ollamaExtra,
    }),
  });

  if (!ollamaRes.ok) {
    throw new Error(`Ollama stream error: ${ollamaRes.status}`);
  }

  // Pipe the raw Ollama NDJSON stream to the client
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");
  Readable.fromWeb(ollamaRes.body).pipe(res);
}

async function _geminiChatStream(messages, res, opts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = opts.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const { systemInstruction, contents } = toGeminiContents(messages);

  const body = { contents };
  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text();
    throw new Error(`Gemini stream error: ${geminiRes.status} – ${errBody}`);
  }

  // Transform the Gemini SSE stream into the same NDJSON format Ollama uses
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  const reader = geminiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const chunk = JSON.parse(jsonStr);
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) {
            // Emit an Ollama-compatible JSON line
            const ollamaChunk = JSON.stringify({
              model,
              message: { role: "assistant", content: text },
              done: false,
            });
            res.write(ollamaChunk + "\n");
          }
        } catch {
          // skip malformed chunk
        }
      }
    }

    // Send final "done" chunk
    res.write(JSON.stringify({ model, message: { role: "assistant", content: "" }, done: true }) + "\n");
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      throw err;
    }
    res.end();
  }
}

async function generate(prompt, opts = {}) {
  const provider = getProvider();

  if (provider === "gemini") {
    return _geminiGenerate(prompt, opts);
  }
  try {
    return await _ollamaGenerate(prompt, opts);
  } catch (err) {
    if (process.env.GEMINI_API_KEY) {
      console.warn("[generate] Ollama unavailable, falling back to Gemini:", err.message);
      return _geminiGenerate(prompt, opts);
    }
    throw err;
  }
}

async function _ollamaGenerate(prompt, opts) {
  const url = "http://localhost:11434/api/generate";
  const model = opts.model || process.env.OLLAMA_MODEL || process.env.MODEL;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      think: true,
      stream: false,
      ...(opts.format && { format: opts.format }),
      ...(opts.options && { options: opts.options }),
    }),
  });

  if (!res.ok) throw new Error(`Ollama generate error: ${res.status}`);
  const data = await res.json();
  return data.response || "";
}

async function _geminiGenerate(prompt, opts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = opts.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  // Map Ollama temperature option to Gemini generationConfig
  if (opts.options?.temperature !== undefined) {
    body.generationConfig = { temperature: opts.options.temperature };
  }

  // If a JSON format was requested, tell Gemini to respond in JSON
  if (opts.format) {
    body.generationConfig = body.generationConfig || {};
    body.generationConfig.responseMimeType = "application/json";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini generate error: ${res.status} – ${errBody}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

module.exports = {
  chat,
  chatStream,
  generate,
  getProvider,
};
