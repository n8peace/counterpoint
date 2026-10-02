# Counterpoint

Every page has an opinion. Counterpoint steelmans the other side.

Reading "buy this"? It tells you the best case for not buying. Reading "X will win"? It gives you the strongest case that they won't. No strawmen, no snark, just the best argument a smart person on the other side would make.

Two ways to use it:

- **Chrome extension** (this folder). Click the button on any page, press Alt+Shift+C, or highlight text and right-click "Counterpoint this".
- **Agent skill** ([skills/counterpoint](skills/counterpoint/SKILL.md)). Drop it into Claude Code (`~/.claude/skills/`) or any agent that reads `SKILL.md` files, then say "counterpoint this".

## Bring your own model

Counterpoint has no server and costs nothing to run. Pick one:

| Option | Cost | Notes |
| --- | --- | --- |
| Chrome built-in AI | Free | Runs on your device. Needs a recent Chrome on a capable machine. Shorter pages only. |
| Claude | Your Anthropic API key | Best quality. Default model `claude-opus-5-5`; set `claude-sonnet-5-5` in settings for cheaper runs. |
| OpenAI | Your OpenAI API key | Model name is editable in settings. |
| Gemini | Your Google AI key | Model name is editable in settings. |

Keys stay in your browser (`chrome.storage.local`) and go only to that provider.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder.
4. Pin Counterpoint, open any article, and click it.

## Privacy

Counterpoint only reads a page when you click it. The page text goes to the model you picked, and nowhere else.

## License

MIT
