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

  if (s.provider === "chrome") {
    const ready = await chromePreflight(job);
    if (!ready) return;
  }

  // view: { title?, body, progress? (undefined none, null spinning, 0..1) }
  let view = { body: "Finding the other side…" };
  const started = Date.now();
  const tick = () => {
    const secs = Math.round((Date.now() - started) / 1000);
    const downloading = view.progress !== undefined;
    card({
      ...view,
      meta: secs >= 3 ? `${secs}s` : "",
      hint:
        !downloading && s.provider === "chrome" && secs >= 45
          ? "Taking long? Relaunch Chrome, or add an API key in settings for a faster answer."
          : downloading
          ? "You can keep browsing. Leave this panel open until it finishes."
          : "",
    });
  };
  tick();
  const timer = setInterval(() => (current === job ? tick() : clearInterval(timer)), 1000);
  try {
    const text = await withTimeout(
      p.run(
        SYSTEM,
        userMessage(job, p.maxChars),
        { key, model: s.models[s.provider] || p.defaultModel },
        (update) => {
          view = typeof update === "string" ? { body: update } : update;
          badge(view.progress !== undefined ? "↓" : "");
          if (current === job) tick();
        }
      ),
      s.provider === "chrome" ? 1_800_000 : 180_000
    );
    if (current === job) out.innerHTML = render(text);
  } catch (e) {
    if (current === job) show(e.message, "error");
  } finally {
    clearInterval(timer);
    badge("");
  }
}

// Explain Chrome's built-in AI state before trying it. Returns true when it can run.
async function chromePreflight(job) {
  const state = await chromeModelState();
  const version = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 0);
  const useKey = { label: "Use an API key instead", onClick: () => ($("settings").hidden = false) };

  if (state === "missing") {
    const tooOld = !version || version < MIN_CHROME;
    card(
      tooOld
        ? {
            title: "Chrome update required",
            body: `Counterpoint's free mode uses Chrome's built-in AI, which needs Chrome ${MIN_CHROME} or newer.${version ? ` You have Chrome ${version}.` : ""}`,
            hint: "To update: Chrome menu (⋮) → Help → About Google Chrome, then click Relaunch.",
            actions: [{ label: "Check again", primary: true, onClick: () => run(job) }, useKey],
          }
        : {
            title: "Chrome's built-in AI is turned off",
            body: `You have Chrome ${version}, which supports it, but it isn't switched on here. If Chrome shows "Relaunch to update", relaunch first.`,
            hint: "On a work or school computer, your organization may have turned it off. You can always use your own API key instead.",
            actions: [{ label: "Check again", onClick: () => run(job) }, { ...useKey, primary: true }],
          }
    );
    return false;
  }
  if (state === "unavailable") {
    card({
      title: "This computer can't run Chrome's AI",
      body: "Chrome's built-in model needs about 22 GB of free disk space and either a GPU with more than 4 GB of memory or 16 GB of RAM.",
      hint: "Free up disk space and check again, or use your own API key.",
      actions: [{ label: "Check again", onClick: () => run(job) }, { ...useKey, primary: true }],
    });
    return false;
  }
  // Chrome only starts the download from a click inside this panel.
  if (state === "downloadable" && !navigator.userActivation.isActive) {
    card({
      title: "One-time setup",
      body: "Counterpoint's free mode runs on Chrome's built-in AI. Chrome needs to download the model once (a few GB). After that it runs on your computer, offline, at no cost.",
      actions: [{ label: "Download model and run", primary: true, onClick: () => run(job) }, useKey],
    });
    return false;
  }
  return true;
}

const MIN_CHROME = 138;

function card({ title, body, progress, meta, hint, actions = [] }) {
  out.innerHTML = `<div class="card">
    ${title ? `<h2>${esc(title)}</h2>` : ""}
    <p class="status">${esc(body)}${meta ? ` <span class="meta">${esc(meta)}</span>` : ""}</p>
    ${progress === undefined ? "" : progress === null
      ? `<div class="bar indeterminate"><span></span></div>`
      : `<div class="bar"><span style="width:${Math.round(progress * 100)}%"></span></div><p class="pct">${Math.round(progress * 100)}%</p>`}
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
    <div class="actions"></div>
  </div>`;
  const row = out.querySelector(".actions");
  for (const a of actions) {
    const b = document.createElement("button");
    b.textContent = a.label;
    if (a.primary) b.className = "primary";
    b.addEventListener("click", a.onClick);
    row.append(b);
  }
}

function badge(text) {
  chrome.action?.setBadgeBackgroundColor?.({ color: "#c2410c" });
  chrome.action?.setBadgeText?.({ text });
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
