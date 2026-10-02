# Chrome Web Store listing (paste into the developer dashboard)

## Name
Counterpoint: see the other side

## Summary (132 characters max)
Every page has an opinion. Counterpoint makes the strongest honest case for the other side. Free on-device AI or your own key.

## Category
Productivity (alternate: Education)

## Description
Every page is trying to convince you of something. A product page wants you to buy. A forecast wants you to believe it. An op-ed wants you to agree.

Counterpoint reads the page you're on, names what it's pushing, and makes the strongest honest case for the other side. Not a strawman, not a "both sides" summary: the argument a smart expert who disagrees would actually make.

HOW IT WORKS
• Click the Counterpoint button (or press Alt+Shift+C) on any page
• Get a short answer in seconds: what the page says, the other side, and the three strongest arguments
• Tap Say more for the details: what evidence would settle it, searches to read the other side, and a chart when real numbers help
• Ask follow-up questions right in the panel
• Highlight any passage, right-click, and choose "Counterpoint this"
• Keep the panel open and it follows you from tab to tab

FREE AND PRIVATE BY DEFAULT
Counterpoint runs on Chrome's built-in AI, which works on your computer, offline, at no cost. Nothing leaves your machine.

Prefer a bigger model? Bring your own API key for Claude, OpenAI, or Gemini. Your key stays in your browser and goes only to that provider.

NO SERVER, NO ACCOUNT, OPEN SOURCE
There's no Counterpoint server and no sign-up. The code is MIT-licensed on GitHub, along with a matching agent skill for Claude Code and other agents: https://github.com/n8peace/counterpoint

## Single purpose (for review)
Counterpoint shows the strongest counter-argument to the web page or text selection the user is viewing, in Chrome's side panel.

## Permission justifications (for review)
- activeTab: read the current page's text when the user clicks the toolbar button, uses the shortcut, or the context menu.
- scripting: extract the readable text of that page.
- sidePanel: show the counter-argument next to the page.
- storage: save settings and the user's own API keys locally, and recent answers for the session.
- contextMenus: add "Counterpoint this" for selected text.
- Host permissions for api.anthropic.com, api.openai.com, generativelanguage.googleapis.com: send the page text to the AI provider the user chose, with the user's own key.
- Optional host permission (all sites): requested only if the user asks the panel to follow them between tabs, so it can read the page they switch to.

## Remote code
No. All code ships in the package. Model responses are treated as text and data, never executed.

## Data usage disclosures
- Collects: Website content (page text), only to send to the user's chosen AI provider or process on-device, to provide the core feature.
- Authentication information: the user's own API keys, stored locally, sent only to that provider.
- Not sold, not used for anything unrelated to the core feature, not used for credit or lending.

## Privacy policy URL
https://github.com/n8peace/counterpoint/blob/master/PRIVACY.md

## Images (in store/assets)
- Screenshots, in this order: screenshot-1-ring.png, screenshot-2-remote.png, screenshot-3-followup.png, screenshot-4-select.png, screenshot-5-free.png (1280x800)
- Small promo tile: promo-tile-440x280.png
- Store icon: icons/icon128.png
- The sites in the screenshots are made up. Rebuild them from store/shots/ if the panel changes.
