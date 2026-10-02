// Runs inside the page (via chrome.scripting). Prefer the article body; skip nav, ads, footers.
// Must stay self-contained: it's serialized and injected, so it can't use anything outside itself.
export function extractPage() {
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

// Read a tab into a job the panel can run. Needs activeTab (toolbar click) or host permission.
export async function readTab(tab) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage });
    return { kind: "page", url: tab.url, title: tab.title, text: result, tabId: tab.id, id: Date.now() };
  } catch (e) {
    return {
      kind: "error", url: tab.url, title: tab.title, tabId: tab.id, id: Date.now(),
      error: `Can't read this page (${e.message}). Chrome blocks extensions on its own pages and the Web Store.`,
    };
  }
}
