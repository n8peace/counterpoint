import { PROVIDERS, chromeModelState } from "./providers.js";
import { SYSTEM, userMessage } from "./prompt.js";

const $ = (id) => document.getElementById(id);
const out = $("out");
let current = null;

// ---- settings ----
for (const [id, p] of Object.entries(PROVIDERS)) {
  $("provider").add(new Option(p.label, id));
}

async function loadSettings() {
  const { settings = {} } = await chrome.storage.local.get("settings");
  return { provider: "chrome", keys: {}, models: {}, ...settings };
}

async function fillSettings() {
  const s = await loadSettings();
  $("provider").value = s.provider;
  syncFields(s);
}

function syncFields(s) {
  const id = $("provider").value;
  const p = PROVIDERS[id];
  $("keyRow").hidden = !p.needsKey;
  $("key").value = s.keys[id] || "";
  $("model").value = s.models[id] || p.defaultModel;
  $("model").disabled = id === "chrome";
}

$("provider").addEventListener("change", async () => syncFields(await loadSettings()));
$("gear").addEventListener("click", () => ($("settings").hidden = !$("settings").hidden));
$("save").addEventListener("click", async () => {
  const s = await loadSettings();
  const id = $("provider").value;
  s.provider = id;
  s.keys[id] = $("key").value.trim();
  s.models[id] = $("model").value.trim() || PROVIDERS[id].defaultModel;
  await chrome.storage.local.set({ settings: s });
  $("settings").hidden = true;
  if (current) run(current);
});

// ---- jobs ----
chrome.storage.session.get("job").then(({ job }) => job && run(job));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.job?.newValue) run(changes.job.newValue);
});
$("again").addEventListener("click", () => current && run(current));

async function run(job) {
  current = job;
  $("foot").hidden = false;
  $("source").textContent = job.kind === "selection" ? `Selection on ${host(job.url)}` : job.title || host(job.url);

  if (job.kind === "error") return show(job.error, "error");
  if (!job.text || job.text.trim().length < 40) return show("Not enough text on this page to find a stance.", "status");

  const s = await loadSettings();
  const p = PROVIDERS[s.provider];
  const key = s.keys[s.provider];
  if (p.needsKey && !key) {
    $("settings").hidden = false;
    return show("Pick a model and add your API key in settings to start.", "status");
  }

  // Chrome only starts its one-time model download from a click inside this panel.
  if (s.provider === "chrome" && !navigator.userActivation.isActive) {
    const state = await chromeModelState();
    if (state === "downloadable") return askToDownload(job);
  }

  let status = "Finding the other side…";
  const started = Date.now();
  const tick = () => {
    const secs = Math.round((Date.now() - started) / 1000);
    show(secs >= 3 ? `${status} ${secs}s` : status, "status");
    if (s.provider === "chrome" && secs >= 30) {
      out.insertAdjacentHTML("beforeend", `<p class="hint">Taking long? Chrome may need a relaunch, or you can add an API key in settings for a faster answer.</p>`);
    }
  };
  tick();
  const timer = setInterval(() => current === job ? tick() : clearInterval(timer), 1000);
  try {
    const text = await withTimeout(
      p.run(
        SYSTEM,
        userMessage(job, p.maxChars),
        { key, model: s.models[s.provider] || p.defaultModel },
        (msg) => { status = msg; if (current === job) tick(); }
      ),
      s.provider === "chrome" ? 600_000 : 180_000
    );
    if (current === job) out.innerHTML = render(text);
  } catch (e) {
    if (current === job) show(e.message, "error");
  } finally {
    clearInterval(timer);
  }
}

function askToDownload(job) {
  out.innerHTML = `<p class="status">Chrome's free AI model isn't on this computer yet. It's a one-time download of a few GB, then it runs offline.</p>
    <button class="primary" id="download">Download and run</button>`;
  $("download").addEventListener("click", () => run(job));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`No answer after ${ms / 60000} minutes. Try Run again, or switch to an API key in settings.`)), ms)
    ),
  ]);
}

function show(msg, cls) {
  out.innerHTML = `<p class="${cls}">${esc(msg)}</p>`;
}

function host(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Tiny markdown: **bold**, "- " bullets, paragraphs. Escape first, always.
function render(md) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  let html = "", list = false;
  for (const line of md.split("\n")) {
    const t = line.trim();
    const bullet = t.match(/^[-*•]\s+(.*)/);
    if (bullet) {
      if (!list) { html += "<ul>"; list = true; }
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }
    if (list) { html += "</ul>"; list = false; }
    if (t) html += `<p>${inline(t)}</p>`;
  }
  return html + (list ? "</ul>" : "");
}

fillSettings();
