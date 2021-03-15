// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require(`vscode`);

const statusView = require(`./src/views/status`);
const commitView = require(`./src/views/commits`);
const fileHistory = require(`./src/views/fileHistory`);
const Git = require(`./src/api/git`);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

function activate(context) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(`Congratulations, your extension "git-client-ibmi" is now active!`);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      `git-client-ibmi.status`,
      new statusView(context)
    ),

    vscode.window.registerTreeDataProvider(
      `git-client-ibmi.commits`,
      new commitView(context)
    ),

    vscode.window.registerTreeDataProvider(
      `git-client-ibmi.fileHistory`,
      new fileHistory(context)
    ),

    vscode.workspace.registerTextDocumentContentProvider(`commitFile`, {
      provideTextDocumentContent: async (uri) => {
        const [repoPath, hash, relativePath] = uri.path.split(`|`);

        const repo = new Git(repoPath);

        if (repo.canUseGit() && await repo.isGitRepo()) {
          const content = await repo.getFileContent(hash, relativePath);
          return content;
        }
      }
    }),

    vscode.commands.registerCommand(`git-client-ibmi.viewCommitFile`, async (commitFile) => {
      const {repoPath, hash, relativePath} = commitFile;
      const commitUri = vscode.Uri.parse([repoPath, hash, relativePath].join(`|`)).with({scheme: `commitFile`});

      let doc = await vscode.workspace.openTextDocument(commitUri); // calls back into the provider
      doc.fileName = relativePath;
      await vscode.window.showTextDocument(doc, { preview: false });
    }),
  );
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate
};