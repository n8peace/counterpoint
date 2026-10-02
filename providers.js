// Bring-your-own-model. Each provider takes (system, user, settings) and
// returns plain text. Keys live in chrome.storage.local and only ever go to
// the provider's own API.

export const PROVIDERS = {
  chrome: {
    label: "Chrome built-in AI (free, on-device)",
    needsKey: false,
    defaultModel: "gemini-nano",
    maxChars: 6000, // small context window
    run: runChrome,
  },
  anthropic: {
    label: "Claude (Anthropic API key)",
    needsKey: true,
    defaultModel: "claude-opus-5-5",
    maxChars: 60000,
    run: runAnthropic,
  },
  openai: {
    label: "OpenAI (API key)",
    needsKey: true,
    defaultModel: "gpt-5-mini",
    maxChars: 60000,
    run: runOpenAI,
  },
  gemini: {
    label: "Google Gemini (API key)",
    needsKey: true,
    defaultModel: "gemini-2.5-flash",
    maxChars: 60000,
    run: runGemini,
  },
};

async function runChrome(system, user, _s, onStatus) {
  if (typeof LanguageModel === "undefined") {
    throw new Error("Chrome built-in AI isn't available in this Chrome. Update Chrome, or pick an API key provider.");
  }
  const langs = {
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  };
  const availability = await LanguageModel.availability(langs);
  if (availability === "unavailable") {
    throw new Error("This device can't run Chrome's built-in model. Pick an API key provider instead.");
  }
  const session = await LanguageModel.create({
    ...langs,
    initialPrompts: [{ role: "system", content: system }],
    monitor(m) {
      m.addEventListener("downloadprogress", (e) =>
        onStatus?.(`Downloading Chrome's model… ${Math.round(e.loaded * 100)}%`)
      );
    },
  });
  try {
    return await session.prompt(user);
  } finally {
    session.destroy();
  }
}

async function runAnthropic(system, user, s) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": s.key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: s.model,
      max_tokens: 16000,
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Anthropic error ${res.status}`);
  if (data.stop_reason === "refusal") throw new Error("Claude declined to answer this one.");
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function runOpenAI(system, user, s) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${s.key}` },
    body: JSON.stringify({
      model: s.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
  return data.choices[0].message.content;
}

async function runGemini(system, user, s) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": s.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gemini error ${res.status}`);
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}
