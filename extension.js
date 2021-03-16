// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require(`vscode`);

const {instance, Field, CustomUI} = vscode.extensions.getExtension(`halcyontechltd.code-for-ibmi`).exports;

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

    vscode.commands.registerCommand(`git-client-ibmi.createGitLibs`, async () => {
      const connection = instance.getConnection();

      if (connection) {
        let wizard = new CustomUI();
        let field;

        // field = new Field(`text`, `info1`);
        // field.description = `This wizard will setup the configuration to make sure that source members are copied into a specific directory when saved - and also vice-versa when 'restored'/'checkout' from git when undoing changes. This is really the start of tracking your source members into a git repository. These settings apply to all users who use this extension as they are saved onto the IFS for all users. This attempts to create <code>/.gitlibs.json</code> in the IFS.`;
        // wizard.addField(field);

        field = new Field(`input`, `library`, `Source library`);
        field.description = `The library which contains the source. Whenever you save a member which resides in this library (in any source file), then it will be copies to the directory you specify.`;
        wizard.addField(field);

        field = new Field(`input`, `ifsPath`, `IFS path`);
        field.description = `The directory in which the source will be copied to. This directory is usually a git repository.`
        wizard.addField(field);

        field = new Field(`input`, `asp`, `ASP (optional)`);
        field.description = `If this library resides in an ASP, you should specify it here - otherwise leave it blank. If you don't provide one where it is needed, you may have issues restoring from git.`
        wizard.addField(field);

        field = new Field(`submit`, `doSubmitThingy`, `Setup`);
        wizard.addField(field);

        const {panel, data} = await wizard.loadPage(`Setup git library`);

        if (data) {
          panel.dispose();
          
          if (data.asp.trim() === ``) data.asp = undefined;

          const content = instance.getContent();

          /** @type {string} */
          let jsonContent;
          let gitlibs;
        
          try {
            jsonContent = await content.downloadStreamfile(`/.gitlibs.json`);
          } catch (e) {
            //Doesn't exist...
            gitlibs = [];
          }

          if (jsonContent) {
            try {
              gitlibs = JSON.parse(jsonContent);
            } catch (e) {
              vscode.window.showErrorMessage(`Unable to read /.gitlibs.json. Invalid JSON.`);
            }
          }

          if (gitlibs) {
            try {
              gitlibs.push(data);
              await content.writeStreamfile(`/.gitlibs.json`, JSON.stringify(gitlibs, null, 2));

              vscode.window.showInformationMessage(`.gitlibs.json updated.`);

            } catch (e) {
              vscode.window.showErrorMessage(`Unable to update /.gitlibs.json. ${e.message || e}`);
            }
          }

        }
      } else {
        vscode.window.showInformationMessage(`Connection to IBM i required to run wizard.`);
      }
    }),
  );
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate
};