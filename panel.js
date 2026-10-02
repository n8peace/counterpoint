import { PROVIDERS, chromeModelState, chromeDetail } from "./providers.js";
import { systemPrompt, userMessage, SAY_MORE } from "./prompt.js";
import { readTab } from "./extract.js";

const $ = (id) => document.getElementById(id);
const out = $("out");
const MIN_CHROME = 138;

let job = null; // the page or selection being countered
let convo = null; // { key, provider, model, messages: [{role, content}] }
let busy = false;
let runId = 0; // each run gets a number; only the newest one may draw
let chromeReport = ""; // e.g. "Chrome 152 · model: downloading"

const ICONS = {
  mark: `<svg viewBox="0 0 40 16" aria-hidden="true"><path d="M2 14 C 14 14, 26 2, 38 2" opacity=".45"/><path d="M2 2 C 14 2, 26 14, 38 14"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>`,
  more: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>`,
};

// ---------- settings ----------

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
  $("auto").checked = autoRun({ ...s, provider: id });
}

// Run on its own when you switch pages? Default: yes for the free on-device model, no when it costs money.
const autoRun = (s) => s.auto?.[s.provider] ?? !PROVIDERS[s.provider].needsKey;

$("providers").addEventListener("change", async () => syncFields(await loadSettings()));
$("gear").addEventListener("click", () => openSettings($("settings").hidden));
$("cancel").addEventListener("click", () => openSettings(false));
$("save").addEventListener("click", async () => {
  const s = await loadSettings();
  const id = chosen();
  s.provider = id;
  s.keys[id] = $("key").value.trim();
  s.models[id] = $("model").value.trim() || PROVIDERS[id].defaultModel;
  s.auto = { ...s.auto, [id]: $("auto").checked };
  await chrome.storage.local.set({ settings: s });
  if (s.auto[id]) await askToFollow(); // the click on Save lets us ask for permission
  openSettings(false);
  runAgain();
});

// ---------- jobs ----------

chrome.storage.session.get("job").then(({ job: j }) => (j ? run(j) : welcome()));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.job?.newValue) run(changes.job.newValue);
});

// ---------- following the active tab ----------

const ALL_SITES = { origins: ["<all_urls>"] };
let windowId = null;
chrome.windows?.getCurrent?.().then((w) => (windowId = w.id));

chrome.tabs?.onActivated?.addListener(({ tabId, windowId: w }) => {
  if (w === windowId) pageChanged(tabId);
});
chrome.tabs?.onUpdated?.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.active && tab.windowId === windowId) pageChanged(tabId, true);
});

const canFollow = () => chrome.permissions?.contains?.(ALL_SITES) ?? Promise.resolve(false);
// Must be called from a click: Chrome only shows the permission prompt in response to one.
const askToFollow = () => chrome.permissions?.request?.(ALL_SITES).catch(() => false) ?? Promise.resolve(false);
const isWebPage = (url) => /^https?:/.test(url || "");

let lastTab = null;
async function pageChanged(tabId, navigated = false) {
  if (!navigated && tabId === job?.tabId) return; // back on the page we're showing
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  lastTab = tab;
  const can = await canFollow();
  if (can && tab.url === job?.url && job?.kind === "page") return;
  if (can && !isWebPage(tab.url)) return newPage(tab, { unreadable: true });

  if (can) {
    const prior = await saved(keyFor({ kind: "page", url: tab.url }));
    if (prior) {
      job = { kind: "page", url: tab.url, title: tab.title, tabId: tab.id };
      convo = prior;
      header(job);
      return show();
    }
    if (autoRun(await loadSettings())) return run(await readTab(tab));
  }
  newPage(tab, { can });
}

// A page we haven't countered yet. Offer to, without spending anything.
function newPage(tab, { can = false, unreadable = false } = {}) {
  ++runId; // stop anything still drawing for the old page
  busy = false;
  job = { kind: "pending", url: tab.url || "", title: tab.title || "", tabId: tab.id };
  convo = null;
  header(job);
  $("composer").hidden = true;
  if (unreadable) return state({ title: "Nothing to counter here", body: "Counterpoint works on web pages. Chrome doesn't let extensions read its own pages or the Web Store." });
  state({
    title: "New page",
    body: can
      ? "Want the other side of this one?"
      : "Want the other side of this one? To follow you from tab to tab, Counterpoint needs Chrome's permission to read the page you're on. It still only sends a page to the model when it runs.",
    actions: [{ label: "Counterpoint this page", primary: true, onClick: () => counterTab(tab) }],
  });
}

async function counterTab(tab) {
  if (!(await canFollow()) && !(await askToFollow())) {
    return toast("No permission, so use the Counterpoint button in the toolbar instead.");
  }
  const fresh = await chrome.tabs.get(tab.id).catch(() => tab);
  run(await readTab(fresh));
}

// Re-run the current page. Restored answers don't keep the page text, so read the tab again.
async function runAgain() {
  if (!job || job.kind === "pending") return;
  if (job.text || job.kind !== "page") return run(job, { fresh: true });
  const tab = await chrome.tabs.get(job.tabId).catch(() => null);
  if (tab) run(await readTab(tab), { fresh: true });
}

function header(j) {
  $("host").textContent = j.kind === "selection" ? `Selection on ${host(j.url)}` : host(j.url) || "Counterpoint";
  $("pageTitle").textContent = j.title || "";
}

function welcome() {
  const mac = /Mac/.test(navigator.platform);
  out.innerHTML = `<div class="state">
    <div class="logo">${ICONS.mark}</div>
    <h2>See the other side of any page</h2>
    <p>Counterpoint finds what a page wants you to believe or buy, then makes the strongest honest case against it.</p>
    <ul class="ways">
      <li><b>Click the Counterpoint button</b> in the toolbar on any page</li>
      <li><b>Press ${mac ? "<kbd>⌥</kbd> <kbd>⇧</kbd> <kbd>C</kbd>" : "<kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>C</kbd>"}</b> to do the same from the keyboard</li>
      <li><b>Highlight text</b>, right-click, and choose Counterpoint this</li>
    </ul>
  </div>`;
}

const keyFor = (j) => `${j.kind}|${j.url}|${j.kind === "selection" ? j.text.slice(0, 200) : ""}`;

async function saved(key) {
  const { results = {} } = await chrome.storage.session.get("results");
  return results[key];
}

async function save(c) {
  const { results = {} } = await chrome.storage.session.get("results");
  results[c.key] = c;
  const keys = Object.keys(results);
  for (const k of keys.slice(0, Math.max(0, keys.length - 30))) delete results[k]; // keep the last 30
  await chrome.storage.session.set({ results });
}

// Start (or restore) the counterpoint for a page.
async function run(j, { fresh = false } = {}) {
  job = j;
  const me = ++runId;
  const live = () => me === runId;
  busy = false;
  header(j);
  $("composer").hidden = true;
  $("via").textContent = "";

  if (j.kind === "error") return state({ title: "Can't read this page", body: j.error, error: true });
  if (!j.text || j.text.trim().length < 40) {
    return state({ title: "Not much to argue with here", body: "This page has too little text to find a stance. Try an article or a product page, or highlight a passage." });
  }

  const s = await loadSettings();
  if (!live()) return;
  const p = PROVIDERS[s.provider];
  const model = s.models[s.provider] || p.defaultModel;
  const key = keyFor(j);

  const prior = !fresh && (await saved(key));
  if (!live()) return;
  if (prior) {
    convo = prior;
    return show();
  }

  if (p.needsKey && !s.keys[s.provider]) {
    openSettings(true);
    return state({ title: `Add your ${p.label} key`, body: "Paste it in settings above, or pick Chrome built-in AI to run free on your computer." });
  }
  if (s.provider === "chrome") {
    checking("Checking Chrome's built-in AI", "Making sure the free model is on this computer and ready to run.");
    if (!(await chromePreflight(live))) return;
  }

  convo = { key, provider: s.provider, model, messages: [{ role: "user", content: userMessage(j, p.maxChars) }] };
  await think(live, s, "low");
}

// Ask for the full version.
async function sayMore() {
  if (busy || !convo) return;
  const s = await loadSettings();
  convo.messages.push({ role: "user", content: SAY_MORE, more: true });
  const me = ++runId;
  await think(() => me === runId, s, "medium");
}

// Ask a follow-up about the current page.
$("ask").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("question").value.trim();
  if (!q || busy || !convo) return;
  const s = await loadSettings();
  $("question").value = "";
  convo.messages.push({ role: "user", content: q });
  const me = ++runId;
  await think(() => me === runId, s, "low");
});
$("question").addEventListener("input", syncSend);

function syncSend() {
  $("send").disabled = busy || !$("question").value.trim();
}

// Send the conversation to the model and draw the result.
async function think(live, s, effort) {
  const c = convo;
  const p = PROVIDERS[c.provider];
  const first = c.messages.length === 1;
  busy = true;
  syncSend();

  let view = { body: first ? "Reading the page…" : "" };
  const started = Date.now();
  const tick = () => {
    const secs = Math.round((Date.now() - started) / 1000);
    if (view.progress !== undefined) {
      return state({
        ...view,
        meta: elapsed(secs),
        hint: "Chrome only downloads its model when your computer has at least 22 GB of free disk space. If this doesn't finish, free up space and Chrome will start on its own. You can close this panel meanwhile.",
        actions: [{ label: "Use an API key instead", onClick: () => openSettings(true) }],
      });
    }
    if (first) {
      const slow = c.provider === "chrome" && secs >= 45 ? " Taking long? Relaunch Chrome, or add an API key in settings." : "";
      skeleton(`${view.body}${secs >= 3 ? ` ${secs}s` : ""}${slow}`);
    } else show({ pending: true });
    if (c.messages.at(-1).more) return; // the Say more spot already shows progress
  };
  tick();
  const timer = setInterval(() => (live() ? tick() : clearInterval(timer)), 1000);

  try {
    const text = await withTimeout(
      p.run(systemPrompt({ charts: p.charts }), c.messages.map(({ role, content }) => ({ role, content })), { key: s.keys[c.provider], model: c.model, effort }, (update) => {
        if (!live()) return;
        view = typeof update === "string" ? { body: update } : update;
        badge(view.progress !== undefined ? "↓" : "");
        tick();
      }),
      c.provider === "chrome" ? 1_800_000 : 180_000
    );
    if (!live()) return;
    c.messages.push({ role: "assistant", content: text });
    busy = false;
    await save(c);
    show();
  } catch (e) {
    if (!live()) return;
    busy = false;
    if (first) {
      state({ title: "That didn't work", body: e.message, error: true, actions: [{ label: "Try again", primary: true, onClick: () => run(job, { fresh: true }) }] });
    } else {
      const asked = c.messages.pop();
      if (!asked.more) $("question").value = asked.content; // give the question back
      show();
      toast(e.message);
    }
  } finally {
    clearInterval(timer);
    if (live()) badge("");
    syncSend();
  }
}

// ---------- Chrome's built-in model ----------

// Explain Chrome's built-in AI state before trying it. Returns true when it can run.
async function chromePreflight(live) {
  const st = await chromeModelState();
  if (!live()) return false;
  const version = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 0);
  chromeReport = `Chrome ${version || "?"} · model: ${chromeDetail}`;
  const useKey = { label: "Use an API key instead", onClick: () => openSettings(true) };
  const again = { label: "Check again", onClick: () => run(job, { fresh: true }) };

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
      actions: [{ label: "Download model and run", primary: true, onClick: () => run(job, { fresh: true }) }, useKey],
    });
    return false;
  }
  return true;
}

// ---------- drawing ----------

function show({ pending = false } = {}) {
  const m = convo.messages;
  const asked = m[2]?.more; // "Say more" was asked
  const full = asked ? m[3] : null;
  const main = full || m[1];
  const rest = m.slice(asked ? 4 : 2);
  let html = renderAnswer(main.content, { short: !full, loadingMore: asked && !full && pending });
  for (let i = 0; i < rest.length; i += 2) {
    const q = rest[i], a = rest[i + 1];
    html += `<div class="turn"><div class="q">${esc(q.content)}</div>${
      a ? `<div class="a">${renderPlain(a.content)}</div>` : pending ? `<div class="a"><span class="typing"><i></i><i></i><i></i></span></div>` : ""
    }</div>`;
  }
  out.innerHTML = html;
  out.querySelector("[data-copy]")?.addEventListener("click", () => copy(main.content));
  out.querySelector("[data-more]")?.addEventListener("click", sayMore);
  out.querySelector("[data-again]")?.addEventListener("click", runAgain);
  const p = PROVIDERS[convo.provider];
  $("via").textContent = convo.provider === "chrome" ? "Chrome built-in AI · on this computer" : `${p.label} · ${convo.model}`;
  $("composer").hidden = false;
  syncSend();
  if (rest.length) out.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
}

// Shown while we ask Chrome about its model, which can take a few seconds.
function checking(title, body) {
  out.innerHTML = `<div class="state checking">
    <div class="logo">${ICONS.mark}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(body)}</p>
    <div class="progress unknown"><span></span></div>
  </div>`;
}

function skeleton(status) {
  out.innerHTML = `<div class="skeleton" aria-label="Loading">
    <div class="card says"><div class="line w40"></div><div class="line w90"></div><div class="line w60"></div></div>
    <div class="card counter"><div class="line w40"></div><div class="line w90"></div><div class="line w80"></div></div>
    <div class="line w90" style="margin-top:14px"></div><div class="line w80"></div><div class="line w90"></div><div class="line w60"></div>
  </div>${status ? `<p class="status">${esc(status)}</p>` : ""}`;
}

function state({ title, body, progress, meta, hint, error, actions = [] }) {
  const loading = progress !== undefined;
  const pct = typeof progress === "number" ? Math.round(progress * 100) : null;
  const chromeScreen = loading || actions.some((a) => a.label === "Use an API key instead" || a.label === "Download model and run");
  out.innerHTML = `<div class="state${error ? " error" : ""}">
    ${error ? "" : `<div class="logo">${ICONS.mark}</div>`}
    ${title ? `<h2>${esc(title)}</h2>` : ""}
    <p>${esc(body)}</p>
    ${loading
      ? `<div class="progress${pct === null ? " unknown" : ""}"><span${pct === null ? "" : ` style="width:${pct}%"`}></span></div>
         <p class="pct">${pct === null ? "" : `${pct}% · `}${esc(meta || "")}${pct === null ? " · Chrome doesn't report a percent" : ""}</p>`
      : ""}
    ${hint ? `<p>${esc(hint)}</p>` : ""}
    <div class="actions"></div>
    ${chromeScreen && chromeReport ? `<p class="diag">${esc(chromeReport)}</p>` : ""}
  </div>`;
  const row = out.querySelector(".actions");
  for (const a of actions) {
    const b = document.createElement("button");
    b.textContent = a.label;
    b.className = a.primary ? "filled-btn" : "outline-btn";
    b.addEventListener("click", a.onClick);
    row.append(b);
  }
}

// ---------- the answer ----------

const HEADS = [
  ["says", /^the page says\b/i],
  ["counter", /^the counterpoint\b/i],
  ["args", /^strongest arguments\b/i],
  ["settle", /^what would settle it\b/i],
  ["search", /^search the other side\b/i],
];

// Pull out ```chart blocks, then split the rest into its parts. Small models drift, so match loosely.
function parse(md) {
  const charts = [];
  const text = md.replace(/```chart\s*([\s\S]*?)```/gi, (_, json) => {
    const c = readChart(json);
    if (c) charts.push(c);
    return "";
  });
  const parts = { says: [], counter: [], args: [], settle: [], search: [], charts };
  let cur = null;
  for (const raw of text.split("\n")) {
    const t = raw.trim().replace(/^#+\s*/, "");
    if (!t) continue;
    const bare = t.replace(/\*\*/g, "").trim();
    const head = HEADS.find(([, re]) => re.test(bare));
    if (head) {
      cur = head[0];
      const rest = bare.replace(head[1], "").replace(/^\s*:\s*/, "").trim();
      if (rest) parts[cur].push(rest);
      continue;
    }
    if (cur) parts[cur].push(t.replace(/^([-*•]|\d+[.)])\s+/, ""));
  }
  return parts.says.length && parts.counter.length ? parts : null;
}

function renderAnswer(md, { short = false, loadingMore = false } = {}) {
  const p = parse(md);
  const more = loadingMore
    ? `<div class="more-loading" aria-label="Loading the full version"><div class="line w90"></div><div class="line w80"></div><div class="line w60"></div></div>`
    : short
    ? `<button class="tonal-btn more-btn" data-more>${ICONS.more}Say more</button>`
    : "";
  const actions = `${more}<div class="answer-actions">
    <button class="icon-btn" data-copy aria-label="Copy" title="Copy">${ICONS.copy}</button>
    <button class="icon-btn" data-again aria-label="Run again" title="Run again">${ICONS.refresh}</button>
  </div>`;
  if (!p) return `<div class="answer plain">${renderPlain(md)}${actions}</div>`;
  const list = (items, cls) => `<ul class="points ${cls}">${items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`;
  const queries = p.search.map((q) => q.replace(/^["“]|["”]$/g, "")).filter(Boolean).slice(0, 3);
  return `<article class="answer">
    <section class="card says"><p class="label">The page says</p><p class="claim">${inline(p.says.join(" "))}</p></section>
    <section class="card counter"><p class="label">The other side</p><h2 class="thesis">${inline(p.counter.join(" "))}</h2></section>
    ${p.args.length ? `<section class="section"><h3 class="section-head">Strongest arguments</h3>${list(p.args, "args")}</section>` : ""}
    ${p.charts.map(renderChart).join("")}
    ${p.settle.length ? `<section class="section"><h3 class="section-head">What would settle it</h3>${list(p.settle, "settle")}</section>` : ""}
    ${queries.length ? `<section class="section"><h3 class="section-head">Search the other side</h3><div class="chips">${queries
      .map((q) => `<a class="chip" href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">${ICONS.search}<span>${esc(q)}</span></a>`)
      .join("")}</div></section>` : ""}
    ${actions}
  </article>`;
}

// Charts arrive as data. Validate everything; draw nothing we don't understand.
function readChart(json) {
  let c;
  try { c = JSON.parse(json); } catch { return null; }
  const str = (v, n = 80) => (typeof v === "string" ? v.slice(0, n) : "");
  if (c?.type === "bar" && Array.isArray(c.items)) {
    const items = c.items
      .filter((i) => typeof i?.value === "number" && isFinite(i.value) && i.value >= 0)
      .slice(0, 6)
      .map((i) => ({ label: str(i.label, 60), value: i.value }));
    if (items.length < 2) return null;
    return { type: "bar", title: str(c.title), unit: str(c.unit, 8), note: str(c.note, 160), items };
  }
  if (c?.type === "compare" && Array.isArray(c.columns) && Array.isArray(c.rows)) {
    const columns = c.columns.slice(0, 3).map((x) => str(x, 30));
    const rows = c.rows
      .filter((r) => Array.isArray(r?.values))
      .slice(0, 6)
      .map((r) => ({ label: str(r.label, 40), values: columns.map((_, i) => str(r.values[i], 60)) }));
    if (columns.length < 2 || !rows.length) return null;
    return { type: "compare", title: str(c.title), note: str(c.note, 160), columns, rows };
  }
  return null;
}

function renderChart(c) {
  const head = c.title ? `<h4>${esc(c.title)}</h4>` : "";
  const note = c.note ? `<p class="note">${esc(c.note)}</p>` : "";
  if (c.type === "bar") {
    const max = Math.max(...c.items.map((i) => i.value)) || 1;
    const fmt = (v) => {
      const n = v.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return /^[$€£¥]$/.test(c.unit) ? c.unit + n : c.unit ? `${n} ${c.unit}` : n;
    };
    return `<figure class="chart">${head}<div class="bars">${c.items
      .map((i) => `<div class="bar-row"><div class="bar-top"><span>${esc(i.label)}</span><b>${esc(fmt(i.value))}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, (i.value / max) * 100)}%"></div></div></div>`)
      .join("")}</div>${note}</figure>`;
  }
  return `<figure class="chart">${head}<table class="compare"><thead><tr><th></th>${c.columns.map((x) => `<th scope="col">${esc(x)}</th>`).join("")}</tr></thead><tbody>${c.rows
    .map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.values.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>${note}</figure>`;
}

// For follow-ups and answers that don't follow the format.
function renderPlain(md) {
  md = md.replace(/```chart[\s\S]*?```/gi, "");
  let html = "", list = false;
  for (const line of md.split("\n")) {
    const t = line.trim();
    const bullet = t.match(/^([-*•]|\d+[.)])\s+(.*)/);
    if (bullet) {
      if (!list) { html += "<ul>"; list = true; }
      html += `<li>${inline(bullet[2])}</li>`;
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

// ---------- small helpers ----------

async function copy(md) {
  const text = md.replace(/```chart[\s\S]*?```/gi, "").replace(/\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim();
  try {
    await navigator.clipboard.writeText(`${text}\n\n(Counterpoint on ${job?.url || "this page"})`);
    toast("Copied");
  } catch {
    toast("Couldn't copy. Select the text instead.");
  }
}

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function elapsed(secs) {
  return secs < 60 ? `${secs}s so far` : `${Math.floor(secs / 60)} min so far`;
}

function badge(text) {
  chrome.action?.setBadgeBackgroundColor?.({ color: "#0b57d0" });
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
