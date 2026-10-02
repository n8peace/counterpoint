// Bring-your-own-model. Each provider takes (system, messages, settings) and
// returns plain text. messages alternate user/assistant and end with user.
// Keys live in chrome.storage.local and only ever go to
// the provider's own API.

export const PROVIDERS = {
  chrome: {
    label: "Chrome built-in AI",
    blurb: "Free. Runs on your computer.",
    needsKey: false,
    defaultModel: "gemini-nano",
    maxChars: 6000, // small context window
    charts: false, // too small to write chart data reliably
    run: runChrome,
  },
  anthropic: {
    label: "Claude",
    blurb: "Your Anthropic API key",
    needsKey: true,
    defaultModel: "claude-opus-5-5",
    maxChars: 60000,
    charts: true,
    run: runAnthropic,
  },
  openai: {
    label: "OpenAI",
    blurb: "Your OpenAI API key",
    needsKey: true,
    defaultModel: "gpt-5-mini",
    maxChars: 60000,
    charts: true,
    run: runOpenAI,
  },
  gemini: {
    label: "Gemini",
    blurb: "Your Google AI Studio key",
    needsKey: true,
    defaultModel: "gemini-2.5-flash",
    maxChars: 60000,
    charts: true,
    run: runGemini,
  },
};

const CHROME_LANGS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

// Chrome wants the output language named. Some installs report a pending
// download when input languages are named too, so fall back to output only.
const CHROME_OUTPUT_ONLY = { expectedOutputs: CHROME_LANGS.expectedOutputs };
let chromeOptions = CHROME_LANGS;
export let chromeDetail = "";

// "missing" | "unavailable" | "downloadable" | "downloading" | "available"
export async function chromeModelState() {
  if (typeof LanguageModel === "undefined") return (chromeDetail = "LanguageModel missing"), "missing";
  const full = await LanguageModel.availability(CHROME_LANGS);
  const outOnly = full === "available" ? full : await LanguageModel.availability(CHROME_OUTPUT_ONLY);
  chromeDetail = full === outOnly ? full : `${full} with input hint, ${outOnly} without`;
  chromeOptions = full !== "available" && outOnly === "available" ? CHROME_OUTPUT_ONLY : CHROME_LANGS;
  return full === "available" ? full : outOnly === "available" ? outOnly : full;
}

async function runChrome(system, messages, _s, onStatus) {
  onStatus?.("Checking Chrome's built-in model…");
  const state = await chromeModelState();
  if (state === "missing") {
    throw new Error("Chrome built-in AI isn't available in this Chrome. Update Chrome, or pick an API key provider.");
  }
  if (state === "unavailable") {
    throw new Error("This device can't run Chrome's built-in model. Pick an API key provider instead.");
  }
  const downloading = (progress) => ({
    title: "Downloading Chrome's AI model",
    body: "One-time download, a few GB. Your answer appears here when it's done.",
    progress,
  });
  onStatus?.(state === "available" ? "Starting Chrome's model…" : downloading(null));
  const session = await LanguageModel.create({
    ...chromeOptions,
    initialPrompts: [{ role: "system", content: system }, ...messages.slice(0, -1)],
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        const done = e.loaded / (e.total || 1);
        onStatus?.(done >= 1 ? "Model ready. Starting…" : downloading(done));
      });
    },
  });
  onStatus?.(messages.length > 1 ? "Thinking…" : "Reading the page…");
  try {
    return await session.prompt(messages.at(-1).content);
  } finally {
    session.destroy();
  }
}

async function runAnthropic(system, messages, s) {
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
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Anthropic error ${res.status}`);
  if (data.stop_reason === "refusal") throw new Error("Claude declined to answer this one.");
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function runOpenAI(system, messages, s) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${s.key}` },
    body: JSON.stringify({
      model: s.model,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
  return data.choices[0].message.content;
}

async function runGemini(system, messages, s) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": s.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gemini error ${res.status}`);
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}
