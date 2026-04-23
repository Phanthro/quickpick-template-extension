import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

/** Fixed templates in the submenu (always in the extension). */
const BUNDLED_CONTEXT_TEMPLATE_REL = path.join("templates", "explain-in-context.md");
const BUNDLED_IMPROVE_TEMPLATE_REL = path.join("templates", "improvement-suggestion.md");

function getBundledFixedTemplatePaths(extensionPath: string): Set<string> {
  const paths = [
    path.join(extensionPath, BUNDLED_CONTEXT_TEMPLATE_REL),
    path.join(extensionPath, BUNDLED_IMPROVE_TEMPLATE_REL)
  ];
  return new Set(paths.map((p) => path.normalize(p)));
}

type TemplateOption = {
  label: string;
  description: string;
  fullPath: string;
};

export function activate(context: vscode.ExtensionContext): void {
  const bundledContextPath = path.join(context.extensionPath, BUNDLED_CONTEXT_TEMPLATE_REL);
  const bundledImprovePath = path.join(context.extensionPath, BUNDLED_IMPROVE_TEMPLATE_REL);
  const excludeFromFolderPicker = getBundledFixedTemplatePaths(context.extensionPath);

  const explainInContext = vscode.commands.registerCommand(
    "quickpickTemplates.explainSnippetInContext",
    async () => {
      await runWithSelection(async (selectedCode) => {
        const chosen: TemplateOption = {
          label: "What does this snippet do in context?",
          description: BUNDLED_CONTEXT_TEMPLATE_REL,
          fullPath: bundledContextPath
        };
        await applyTemplateAndCopy(chosen, selectedCode);
      });
    }
  );

  const suggestImprovements = vscode.commands.registerCommand(
    "quickpickTemplates.suggestImprovements",
    async () => {
      await runWithSelection(async (selectedCode) => {
        const chosen: TemplateOption = {
          label: "Improvement suggestion",
          description: BUNDLED_IMPROVE_TEMPLATE_REL,
          fullPath: bundledImprovePath
        };
        await applyTemplateAndCopy(chosen, selectedCode);
      });
    }
  );

  const fromFolder = vscode.commands.registerCommand(
      "quickpickTemplates.chooseTemplateFromFolder",
      async () => {
        await runWithSelection(async (selectedCode) => {
          const chosen = await showTemplatePickerFromFolder(
            context.extensionPath,
            excludeFromFolderPicker
          );
        
          if (chosen) {
            await applyTemplateAndCopy(chosen, selectedCode);
          }
        }); 
      }
    );

  context.subscriptions.push(explainInContext, suggestImprovements, fromFolder);
}

async function runWithSelection(
  action: (selectedCode: string) => Promise<void>
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor.");
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage(
      "Select a code snippet before using the QuickPick Templates."
    );
    return;
  }

  const selectedCode = editor.document.getText(selection);
  await action(selectedCode);
}

async function applyTemplateAndCopy(
  chosen: TemplateOption,
  selectedCode: string
): Promise<void> {
  const selectedLanguage =
  vscode.workspace
    .getConfiguration()
    .get<string>("quickpickTemplates.language") || "English";

  try {
    const templateContent = await fs.readFile(chosen.fullPath, "utf8");
    const output = templateContent
      .replace(/{{CODE}}/g, selectedCode)
      .replace(/{{LANGUAGE}}/g, selectedLanguage);
    await vscode.env.clipboard.writeText(output);
    vscode.window.showInformationMessage(
      `Template applied: ${chosen.label} in ${selectedLanguage} language. Content copied to the clipboard.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to process template: ${message}`);
  }
}

async function showTemplatePickerFromFolder(
  extensionPath: string,
  excludeBundledPaths: Set<string>
): Promise<TemplateOption | undefined> {
  const quickPick = vscode.window.createQuickPick<TemplateOption>();
  quickPick.title = "Templates — configured folder";
  quickPick.placeholder = `Select a .md file`;
  quickPick.matchOnDescription = true;
  quickPick.busy = true;

  const refreshButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon("refresh"),
    tooltip: "Reload list"
  };
  quickPick.buttons = [refreshButton];

  let templatesDir = getTemplatesDir(extensionPath);

  let finished = false;
  const selectionPromise = new Promise<TemplateOption | undefined>((resolve) => {
    const finish = (value: TemplateOption | undefined): void => {
      if (finished) {
        return;
      }
      finished = true;
      quickPick.hide();
      resolve(value);
    };

    quickPick.onDidAccept(() => {
      const item = quickPick.selectedItems[0] ?? quickPick.activeItems[0];
      if (!item) {
        return;
      }
      finish(item);
    });

    quickPick.onDidHide(() => {
      if (!finished) {
        finish(undefined);
      }
    });

    quickPick.onDidTriggerButton((button) => {
      if (button === refreshButton) {
        void loadTemplates();
      }
    });
  });

  let watcher: vscode.FileSystemWatcher | undefined;
  const watcherDisposables: vscode.Disposable[] = [];
  const watchTemplatesDir = (): void => {
    watcher?.dispose();
    watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(templatesDir, "*.md")
    );
    watcher.onDidCreate(() => {
      void loadTemplates();
    });
    watcher.onDidChange(() => {
      void loadTemplates();
    });
    watcher.onDidDelete(() => {
      void loadTemplates();
    });
    watcherDisposables.push(watcher);
  };

  const loadTemplates = async (): Promise<void> => {
    quickPick.busy = true;
    templatesDir = getTemplatesDir(extensionPath);
    const fromFolder = await listMarkdownTemplates(
      templatesDir,
      extensionPath,
      excludeBundledPaths
    );
    quickPick.items = fromFolder;
    quickPick.busy = false;
    if (fromFolder.length === 0) {
      quickPick.placeholder = `No extra .md files in this folder (the fixed templates are in the submenu). Folder: ${templatesDir}`;
    } else {
      quickPick.placeholder = "Select a .md template";
    }
  };

  watchTemplatesDir();
  const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("quickpickTemplates.templatesPath")) {
      templatesDir = getTemplatesDir(extensionPath);
      watchTemplatesDir();
      void loadTemplates();
    }
  });
  watcherDisposables.push(configWatcher);

  await loadTemplates();
  quickPick.show();
  const selected = await selectionPromise;
  quickPick.dispose();
  for (const disposable of watcherDisposables) {
    disposable.dispose();
  }

  return selected;
}

async function listMarkdownTemplates(
  templatesDir: string,
  extensionPath: string,
  excludeBundledPaths: Set<string>
): Promise<TemplateOption[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(templatesDir);
  } catch {
    return [];
  }

  const markdownFiles = entries
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, "en-US"));

  const defaultTemplates = path.join(extensionPath, "templates");

  return markdownFiles
    .map((name) => {
      const fullPath = path.join(templatesDir, name);
      const desc =
        path.normalize(templatesDir) === path.normalize(defaultTemplates)
          ? `templates/${name}`
          : fullPath;
      return {
        label: name,
        description: desc,
        fullPath
      };
    })
    .filter((o) => !excludeBundledPaths.has(path.normalize(o.fullPath)));
}

export function deactivate(): void {
  // No-op
}

function getTemplatesDir(extensionPath: string): string {
  const config = vscode.workspace.getConfiguration();
  const configuredPath = (config.get<string>("quickpickTemplates.templatesPath") ?? "").trim();
  if (!configuredPath) {
    return path.join(extensionPath, "templates");
  }

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return path.join(extensionPath, "templates");
  }

  return path.join(workspaceFolder.uri.fsPath, configuredPath);
}
