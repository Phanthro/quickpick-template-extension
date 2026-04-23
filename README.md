# Quickpick Templates

Extension for Cursor / VS Code that applies `.md` templates to the selected code snippet and copies the result to the clipboard.

## Workflow

1. Select a code snippet in the editor.
2. Right-click and open the **Quickpick** submenu.
3. Choose:

   * **What does this snippet do in context?** — fixed template `templates/snippet-in-context.md`.
   * **Improvement suggestion** — fixed template `templates/improvement-suggestion.md`.
   * **Template from configured folder…** — lists `.md` files from the folder set in `quickpickTemplates.templatesPath` (or the extension's `templates/` folder). The two fixed templates above **do not appear** in the list when pointing to the same copy inside the extension (avoids duplication).
4. The final text replaces `{{CODE}}` with the selected code and is copied to the clipboard.

## Configure templates path

`Settings` → search for **Quickpick Templates: Templates Path**
Key: `quickpickTemplates.templatesPath`

* **Absolute** — uses the specified folder.
* **Relative** — relative to the root of the opened workspace.
* **Empty** — uses the extension's built-in `templates/` folder.

The list updates automatically when `.md` files change in the watched folder; the **Reload** button forces a refresh.

## Placeholder in `.md`

```md
Explain the code below:

{{CODE}}
```

## Development

```bash
npm install
npm run compile
```

Press `F5` to test the extension.
