// Toolbar click (or Alt+Shift+C) grants activeTab, so we can read the page
// without asking for access to every site. The panel picks the job up from
// session storage.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "counterpoint-selection",
    title: "Counterpoint this",
    contexts: ["selection"],
  });
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }); // must run inside the user gesture
  queuePage(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
  queueJob({
    kind: "selection",
    url: tab.url,
    title: tab.title,
    text: info.selectionText,
  });
});

async function queuePage(tab) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPage,
    });
    queueJob({ kind: "page", url: tab.url, title: tab.title, text: result });
  } catch (e) {
    queueJob({ kind: "error", url: tab.url, title: tab.title, error: `Can't read this page (${e.message}). Chrome blocks extensions on its own pages and the Web Store.` });
  }
}

function queueJob(job) {
  chrome.storage.session.set({ job: { ...job, id: Date.now() } });
}

// Runs inside the page. Prefer the article body; skip nav, ads, footers.
function extractPage() {
  const root =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector("[role=main]") ||
    document.body;
  const clone = root.cloneNode(true);
  clone
    .querySelectorAll("script,style,noscript,nav,footer,header,aside,form,iframe,svg")
    .forEach((n) => n.remove());
  const text = clone.innerText.replace(/\n{3,}/g, "\n\n").trim();
  const meta = document.querySelector('meta[name="description"]')?.content || "";
  return (meta ? meta + "\n\n" : "") + text;
}
