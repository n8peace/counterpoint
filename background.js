// Toolbar click (or Alt+Shift+C) grants activeTab, so we can read the page
// without asking for access to every site. The panel picks the job up from
// session storage.
import { readTab } from "./extract.js";

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: "welcome.html" });
  chrome.contextMenus.create({
    id: "counterpoint-selection",
    title: "Counterpoint this",
    contexts: ["selection"],
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }); // must run inside the user gesture
  queueJob(await readTab(tab));
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
  queueJob({ kind: "selection", url: tab.url, title: tab.title, text: info.selectionText, tabId: tab.id, id: Date.now() });
});

// Ask what didn't work, so we can fix it.
chrome.runtime.setUninstallURL("https://github.com/n8peace/counterpoint/issues/new?title=Why%20I%20uninstalled%20Counterpoint");

function queueJob(job) {
  chrome.storage.session.set({ job });
}
