import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

/** Templates fixos do submenu (sempre na extensão). */
const BUNDLED_CONTEXT_TEMPLATE_REL = path.join("templates", "trecho-no-contexto.md");
const BUNDLED_IMPROVE_TEMPLATE_REL = path.join("templates", "sugestao-melhoria.md");

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
    "acaoRapida.explainSnippetInContext",
    async () => {
      await runWithSelection(async (selectedCode) => {
        const chosen: TemplateOption = {
          label: "O que faz esse trecho no contexto?",
          description: BUNDLED_CONTEXT_TEMPLATE_REL,
          fullPath: bundledContextPath
        };
        await applyTemplateAndCopy(chosen, selectedCode);
      });
    }
  );

  const suggestImprovements = vscode.commands.registerCommand(
    "acaoRapida.suggestImprovements",
    async () => {
      await runWithSelection(async (selectedCode) => {
        const chosen: TemplateOption = {
          label: "Sugestão de melhoria",
          description: BUNDLED_IMPROVE_TEMPLATE_REL,
          fullPath: bundledImprovePath
        };
        await applyTemplateAndCopy(chosen, selectedCode);
      });
    }
  );

  const fromFolder = vscode.commands.registerCommand(
    "acaoRapida.chooseTemplateFromFolder",
    async () => {
      await runWithSelection(async (selectedCode) => {
        const chosen = await showTemplatePickerFromFolder(
          context.extensionPath,
          excludeFromFolderPicker
        );
        if (!chosen) {
          return;
        }
        await applyTemplateAndCopy(chosen, selectedCode);
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
    vscode.window.showErrorMessage("Nenhum editor ativo.");
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage(
      "Selecione um trecho de código antes de usar a Ação Rápida."
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
  try {
    const templateContent = await fs.readFile(chosen.fullPath, "utf8");
    const output = templateContent.split("{{CODE}}").join(selectedCode);
    await vscode.env.clipboard.writeText(output);
    vscode.window.showInformationMessage(
      `Template aplicado: ${chosen.label}. Conteúdo copiado para a área de transferência.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Falha ao processar template: ${message}`);
  }
}

async function showTemplatePickerFromFolder(
  extensionPath: string,
  excludeBundledPaths: Set<string>
): Promise<TemplateOption | undefined> {
  const quickPick = vscode.window.createQuickPick<TemplateOption>();
  quickPick.title = "Templates — pasta configurada";
  quickPick.placeholder = "Selecione um arquivo .md";
  quickPick.matchOnDescription = true;
  quickPick.busy = true;

  const refreshButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon("refresh"),
    tooltip: "Recarregar lista"
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
      quickPick.placeholder = `Nenhum .md extra nesta pasta (os fixos estão no submenu). Pasta: ${templatesDir}`;
    } else {
      quickPick.placeholder = "Selecione um template .md";
    }
  };

  watchTemplatesDir();
  const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("acaoRapida.templatesPath")) {
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
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

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
  const configuredPath = (config.get<string>("acaoRapida.templatesPath") ?? "").trim();
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
