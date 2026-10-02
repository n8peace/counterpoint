import { PROVIDERS, chromeModelState } from "./providers.js";
import { SYSTEM, userMessage } from "./prompt.js";

const $ = (id) => document.getElementById(id);
const out = $("out");
const MIN_CHROME = 138;
let current = null;

// The mark: the page's line and the other side's line, moving in contrary motion.
const mark = (cls = "") =>
  `<svg class="mark ${cls}" viewBox="0 0 40 16" aria-hidden="true"><path class="p" d="M2 14 C 14 14, 26 2, 38 2"/><path class="c" d="M2 2 C 14 2, 26 14, 38 14"/></svg>`;

// ---- settings ----
for (const [id, p] of Object.entries(PROVIDERS)) {
  $("providers").insertAdjacentHTML(
    "beforeend",
    `<label class="opt"><input type="radio" name="provider" value="${id}"><b>${esc(p.label)}</b><span>${esc(p.blurb)}</span></label>`
  );
}
const chosen = () => document.querySelector('input[name="provider"]:checked')?.value || "chrome";

async function loadSettings() {
  const { settings = {} } = await chrome.storage.local.get("settings");
  return { provider: "chrome", keys: {}, models: {}, ...settings };
}

async function openSettings(open = true) {
  if (open) {
    const s = await loadSettings();
    document.querySelector(`input[value="${s.provider}"]`).checked = true;
    syncFields(s);
  }
  $("settings").hidden = !open;
  $("gear").setAttribute("aria-expanded", String(open));
}

function syncFields(s) {
  const id = chosen();
  const p = PROVIDERS[id];
  $("keyRow").hidden = !p.needsKey;
  $("modelRow").hidden = !p.needsKey;
  $("key").value = s.keys[id] || "";
  $("model").value = s.models[id] || p.defaultModel;
}

$("providers").addEventListener("change", async () => syncFields(await loadSettings()));
$("gear").addEventListener("click", () => openSettings($("settings").hidden));
$("cancel").addEventListener("click", () => openSettings(false));
$("save").addEventListener("click", async () => {
  const s = await loadSettings();
  const id = chosen();
  s.provider = id;
  s.keys[id] = $("key").value.trim();
  s.models[id] = $("model").value.trim() || PROVIDERS[id].defaultModel;
  await chrome.storage.local.set({ settings: s });
  openSettings(false);
  if (current) run(current);
});

// ---- jobs ----
chrome.storage.session.get("job").then(({ job }) => (job ? run(job) : welcome()));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.job?.newValue) run(changes.job.newValue);
});
$("again").addEventListener("click", () => current && run(current));

function welcome() {
  const mac = /Mac/.test(navigator.platform);
  out.innerHTML = `<div class="state">
    ${mark()}
    <h2>Every page is arguing something.</h2>
    <p>Counterpoint finds what it's pushing and makes the best case for the other side.</p>
    <ul class="ways">
      <li><b>Click the Counterpoint button</b> on any page</li>
      <li>or press ${mac ? "<kbd>⌥</kbd> <kbd>⇧</kbd> <kbd>C</kbd>" : "<kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>C</kbd>"}</li>
      <li>or highlight text, right-click, and choose <b>Counterpoint this</b></li>
    </ul>
  </div>`;
}

async function run(job) {
  current = job;
  $("host").textContent = job.kind === "selection" ? `Selection on ${host(job.url)}` : host(job.url);
  $("pageTitle").textContent = job.title || "";
  $("foot").hidden = false;
  $("via").textContent = "";

  if (job.kind === "error") return state({ title: "Can't read this page", body: job.error, error: true });
  if (!job.text || job.text.trim().length < 40) {
    return state({ title: "Not much to argue with here", body: "This page has too little text to find a stance. Try an article, a product page, or highlight a passage." });
  }

  const s = await loadSettings();
  const p = PROVIDERS[s.provider];
  const key = s.keys[s.provider];
  const model = s.models[s.provider] || p.defaultModel;
  if (p.needsKey && !key) {
    openSettings(true);
    return state({ title: `Add your ${p.label} key`, body: "Paste it in settings above, or pick Chrome built-in AI to run free on your computer." });
  }
  if (s.provider === "chrome" && !(await chromePreflight(job))) return;

  // view: { title?, body, progress? (undefined = none, null = unknown, 0..1) }
  let view = { body: "Finding the other side…" };
  const started = Date.now();
  const tick = () => {
    const secs = Math.round((Date.now() - started) / 1000);
    const downloading = view.progress !== undefined;
    state({
      ...view,
      moving: !downloading,
      meta: secs >= 3 ? `${secs}s` : "",
      hint: downloading
        ? "You can keep browsing. Leave this panel open until it finishes."
        : s.provider === "chrome" && secs >= 45
        ? "Taking long? Relaunch Chrome, or add an API key in settings for a faster answer."
        : "",
    });
  };
  tick();
  const timer = setInterval(() => (current === job ? tick() : clearInterval(timer)), 1000);
  try {
    const text = await withTimeout(
      p.run(SYSTEM, userMessage(job, p.maxChars), { key, model }, (update) => {
        view = typeof update === "string" ? { body: update } : update;
        badge(view.progress !== undefined ? "↓" : "");
        if (current === job) tick();
      }),
      s.provider === "chrome" ? 1_800_000 : 180_000
    );
    if (current !== job) return;
    out.innerHTML = renderResult(text);
    $("via").textContent = s.provider === "chrome" ? "Chrome built-in AI · on this computer" : `${p.label} · ${model}`;
  } catch (e) {
    if (current === job) state({ title: "That didn't work", body: e.message, error: true, actions: [{ label: "Try again", primary: true, onClick: () => run(job) }] });
  } finally {
    clearInterval(timer);
    badge("");
  }
}

// Explain Chrome's built-in AI state before trying it. Returns true when it can run.
async function chromePreflight(job) {
  const st = await chromeModelState();
  const version = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 0);
  const useKey = { label: "Use an API key instead", onClick: () => openSettings(true) };
  const again = { label: "Check again", onClick: () => run(job) };

  if (st === "missing") {
    const tooOld = !version || version < MIN_CHROME;
    state(
      tooOld
        ? {
            title: "Chrome update required",
            body: `Free mode uses Chrome's built-in AI, which needs Chrome ${MIN_CHROME} or newer.${version ? ` You have Chrome ${version}.` : ""}`,
            hint: "To update, open the Chrome menu (⋮), choose Help, then About Google Chrome, and click Relaunch.",
            actions: [{ ...again, primary: true }, useKey],
          }
        : {
            title: "Chrome's built-in AI is turned off",
            body: `Chrome ${version} supports it, but it isn't on here. If Chrome shows "Relaunch to update", relaunch first.`,
            hint: "On a work or school computer, your organization may have turned it off.",
            actions: [again, { ...useKey, primary: true }],
          }
    );
    return false;
  }
  if (st === "unavailable") {
    state({
      title: "This computer can't run Chrome's AI",
      body: "Chrome's model needs about 22 GB of free disk space, plus either a graphics chip with more than 4 GB of memory or 16 GB of RAM.",
      hint: "Free up disk space and check again, or use your own API key.",
      actions: [again, { ...useKey, primary: true }],
    });
    return false;
  }
  // Chrome only starts the download from a click inside this panel.
  if (st === "downloadable" && !navigator.userActivation.isActive) {
    state({
      title: "One-time setup",
      body: "Free mode runs on Chrome's built-in AI. Chrome downloads the model once (a few GB). After that it runs on your computer, offline, at no cost.",
      actions: [{ label: "Download model and run", primary: true, onClick: () => run(job) }, useKey],
    });
    return false;
  }
  return true;
}

function state({ title, body, progress, meta, hint, moving, error, actions = [] }) {
  const pct = typeof progress === "number" ? Math.round(progress * 100) : null;
  out.innerHTML = `<div class="state${error ? " error" : ""}">
    ${error ? "" : mark(moving || progress !== undefined ? "moving" : "")}
    ${title ? `<h2>${esc(title)}</h2>` : ""}
    <p class="${title ? "" : "lead"}">${esc(body)}${meta ? ` <span class="meta">${esc(meta)}</span>` : ""}</p>
    ${progress === undefined ? "" : pct === null
      ? `<div class="progress unknown"><span></span></div>`
      : `<div class="progress"><span style="width:${pct}%"></span></div><p class="pct">${pct}%</p>`}
    ${hint ? `<p>${esc(hint)}</p>` : ""}
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

// ---- rendering the answer ----

const HEADS = [
  ["says", /^the page says\b/i],
  ["counter", /^the counterpoint\b/i],
  ["args", /^strongest arguments\b/i],
  ["settle", /^what would settle it\b/i],
];

// Split the model's answer into its four parts. Small models drift, so match loosely.
function parse(md) {
  const parts = { says: [], counter: [], args: [], settle: [] };
  let cur = null;
  for (const raw of md.split("\n")) {
    let t = raw.trim().replace(/^#+\s*/, "");
    if (!t) continue;
    const bare = t.replace(/\*\*/g, "").trim();
    const head = HEADS.find(([, re]) => re.test(bare));
    if (head) {
      cur = head[0];
      const rest = bare.replace(head[1], "").replace(/^\s*:\s*/, "").trim();
      if (rest) parts[cur].push(rest);
      continue;
    }
    if (!cur) continue;
    parts[cur].push(t.replace(/^([-*•]|\d+[.)])\s+/, ""));
  }
  return parts.says.length && parts.counter.length ? parts : null;
}

function renderResult(md) {
  const p = parse(md);
  if (!p) return `<div class="result plain">${renderPlain(md)}</div>`;
  const list = (items, cls) => `<ul class="${cls}">${items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`;
  return `<article class="result">
    <section class="says"><p class="label">The page says</p><blockquote>${inline(p.says.join(" "))}</blockquote></section>
    ${mark("divider")}
    <section class="counter"><p class="label">The other side</p><h2 class="thesis">${inline(p.counter.join(" "))}</h2></section>
    ${p.args.length ? `<section><h3 class="section-head">Strongest arguments</h3>${list(p.args, "args")}</section>` : ""}
    ${p.settle.length ? `<section><h3 class="section-head">What would settle it</h3>${list(p.settle, "settle")}</section>` : ""}
  </article>`;
}

// Fallback for answers that don't follow the format (e.g. "this page takes no stance").
function renderPlain(md) {
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
    if (t) html += `<p>${inline(t.replace(/^#+\s*/, ""))}</p>`;
  }
  return html + (list ? "</ul>" : "");
}

// Escape first, always; then allow **bold**.
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function badge(text) {
  chrome.action?.setBadgeBackgroundColor?.({ color: "#2e46d9" });
  chrome.action?.setBadgeText?.({ text });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`No answer after ${ms / 60000} minutes. Try again, or switch to an API key in settings.`)), ms)
    ),
  ]);
}
