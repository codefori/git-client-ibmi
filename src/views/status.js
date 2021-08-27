
const path = require(`path`);
const vscode = require(`vscode`);

const {instance} = vscode.extensions.getExtension(`halcyontechltd.code-for-ibmi`).exports;
const Git = require(`../api/git`);

module.exports = class Status {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    //Used for git status
    this.status = undefined;

    //Used for moving members to streamfiles and vice-versa
    /** @type {{library: string, ifsPath: string, asp?: string}[]|undefined} */
    this.gitLibraries = undefined;

    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration(`code-for-ibmi.connectionSettings`)) {
          this.gitLibraries = undefined;
          this.fetchGitLibs();
          this.refresh();
        }
      }),

      vscode.commands.registerCommand(`git-client-ibmi.status.refresh`, async () => {
        this.refresh();
      }),

      vscode.commands.registerCommand(`git-client-ibmi.status.add`, async (node) => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (node) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            await repo.stage(node.path)
            this.refresh();
          }
        }
      }),

      vscode.commands.registerCommand(`git-client-ibmi.status.remove`, async (node) => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);
        
        if (node) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            await repo.unstage(node.path);
            this.refresh();
          }
        }
      }),

      vscode.commands.registerCommand(`git-client-ibmi.status.restore`, async (node) => {
        const connection = instance.getConnection();
        const content = instance.getContent();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);
        
        if (node) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            await repo.restore(node.path);
            this.refresh();

            await this.fetchGitLibs();
            if (this.gitLibraries) {
              const libConfig = this.gitLibraries.find(setting => setting.ifsPath.toUpperCase().startsWith(repoPath.toUpperCase()));

              if (libConfig) {
                const pathParts = node.path.split(`/`);
                
                const library = libConfig.library.toUpperCase();
                const sourceFile = pathParts[pathParts.length-2].toUpperCase();
                let memberName = pathParts[pathParts.length-1].toUpperCase();
                memberName = memberName.substring(0, memberName.lastIndexOf(`.`));

                try {
                  const fileContent = await content.downloadStreamfile(path.posix.join(repoPath, node.path));
                  await content.uploadMemberContent(libConfig.asp, library, sourceFile, memberName, fileContent);
                } catch (e) {
                  vscode.window.showErrorMessage(`Error copying back to source member ${library}/${sourceFile}/${memberName}. ${e}`)
                }
              }
            }
          }
        }
      }),

      vscode.commands.registerCommand(`git-client-ibmi.status.commit`, async () => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            const message = await vscode.window.showInputBox({
              prompt: `Commit message`
            });

            if (message) {
              try {
                await repo.commit(message);
                await vscode.commands.executeCommand(`git-client-ibmi.commits.refresh`);
                vscode.window.showInformationMessage(`Commit successful.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error making commit in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      vscode.commands.registerCommand(`git-client-ibmi.status.pull`, async () => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            try {
              await repo.pull()
              await vscode.commands.executeCommand(`git-client-ibmi.commits.refresh`);
              vscode.window.showInformationMessage(`Pull successful.`);
            } catch (e) {
              vscode.window.showErrorMessage(e);
            }
            
            this.refresh();
          }
        }
      }),

      vscode.commands.registerCommand(`git-client-ibmi.status.push`, async () => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            try {
              await repo.push();
              await vscode.commands.executeCommand(`git-client-ibmi.branches.refresh`);
              vscode.window.showInformationMessage(`Push successful.`);
            } catch (e) {
              vscode.window.showErrorMessage(e);
            }
            
            this.refresh();
          }
        }
      }),

      vscode.workspace.onDidSaveTextDocument(async (document) => {
        const connection = instance.getConnection();

        if (connection) {
          const repoPath = connection.config.homeDirectory;
          const content = instance.getContent();

          switch (document.uri.scheme) {
          case `member`:
            await this.fetchGitLibs();

            if (this.gitLibraries) {
              let memberParts = document.uri.path.split(`/`);
              const library = memberParts[memberParts.length-3].toUpperCase();
              const sourceFile = memberParts[memberParts.length-2].toLowerCase();
              const baseName = memberParts[memberParts.length-1].toLowerCase();
              
              const libConfig = this.gitLibraries.find(setting => setting.library.toUpperCase() === library);

              if (libConfig) {
                await connection.paseCommand(`mkdir ${path.posix.join(libConfig.ifsPath, sourceFile)}`, `.`, 1);
                await content.writeStreamfile(path.posix.join(libConfig.ifsPath, sourceFile, baseName), document.getText());

                if (libConfig.ifsPath.toUpperCase() === repoPath.toUpperCase()) {
                  this.refresh();
                }
              }
            }
            break;

          case `streamfile`:
            if (document.uri.path.startsWith(repoPath)) {
              this.refresh();
            }
            break;

          }
        }
      })
    );
  }

  refresh() {
    this.emitter.fire();
  }

  async fetchGitLibs() {
    const connection = instance.getConnection();
    if (connection) {
      const content = instance.getContent();

      if (this.gitLibraries === undefined) {
        /** @type {string} */
        let jsonContent;
        let gitlibs;
        
        try {
          jsonContent = await content.downloadStreamfile(`/.gitlibs.json`);
        } catch (e) {
          this.gitLibraries = false;
          //Okay.. file doesn't exist probs
        }

        if (jsonContent) {
          try {
            gitlibs = JSON.parse(jsonContent);
          } catch (e) {
            vscode.window.showErrorMessage(`Unable to read .gitlibs.json. Invalid JSON.`);
          }
        }

        if (gitlibs) {
          let isValid = true;

          if (gitlibs.length === undefined) isValid = false;

          for (const configItem of gitlibs) {
            if (typeof configItem.library !== `string` || typeof configItem.ifsPath !== `string`) {
              isValid = false;
            }
          }

          if (isValid) {
            this.gitLibraries = gitlibs;
          } else {
            vscode.window.showErrorMessage(`.gitlibs.json in incorrect format.`);
          }
        }
      } 
    }
  }

  /**
   * 
   * @param {vscode.TreeItem} element 
   * @returns {vscode.TreeItem}
   */
  getTreeItem(element) {
    return element;
  }

  /**
   * @param {Commit} [element] 
   * @returns {Promise<vscode.TreeItem[]>}
   */
  async getChildren(element) {
    if (this.currentFile === ``) {
      items = [new vscode.TreeItem(`Open file to view history.`)];
      return;
    }

    const connection = instance.getConnection();

    /** @type {vscode.TreeItem[]} */
    let items = [];

    if (connection) {
      const repoPath = connection.config.homeDirectory;
      const repo = new Git(repoPath);

      if (repo.canUseGit() && await repo.isGitRepo()) {

        if (element) {
          switch (element.contextValue) {
          case `changes`:
            items = this.status.unstaged.map(item => new StageFile(repoPath, item.path, item.state, `unstaged`));
            break;
          case `staged`:
            items = this.status.staged.map(item => new StageFile(repoPath, item.path, item.state, `staged`));
            break;
          }

        } else {
          items = [
            new Subitem(`Staged Changes`, `staged`),
            new Subitem(`Changes`, `changes`)
          ];
        }

        try {
          const status = await repo.status();
          this.status = status;
        } catch (e) {
          items = [new vscode.TreeItem(`Error fetching status for ${repoPath}`)];
        }

      } else {
        items = [new vscode.TreeItem(`${repoPath} is not a git repository.`)];
      }

    } else {
      items = [new vscode.TreeItem(`Please connect to an IBM i and refresh.`)];
    }

    return items;
  }
};

class Subitem extends vscode.TreeItem {
  /**
   * @param {string} label 
   * @param {string} contextValue 
   */
  constructor(label, contextValue) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = contextValue;
  }
}

class StageFile extends vscode.TreeItem {
  /**
   * 
   * @param {string} relativePath 
   * @param {string} state 
   */
  constructor(repoPath, relativePath, state, contextValue) {
    super(relativePath, vscode.TreeItemCollapsibleState.None);

    this.path = relativePath;
    this.state = state;
    this.description = descriptions[state];

    this.contextValue = contextValue;

    const commitUri = vscode.Uri.parse([repoPath, `HEAD`, relativePath].join(`|`)).with({scheme: `commitFile`});
    const fileUri = vscode.Uri.parse(path.posix.join(repoPath, relativePath)).with({scheme: `streamfile`});

    this.command = {
      command: `vscode.diff`,
      title: `View diff`,
      arguments: [commitUri, fileUri]
    };
  }
}

let descriptions = {
  ' ': `unmodified`,
  'M': `modified`,
  'A': `added`,
  'D': `deleted`,
  'R': `renamed`,
  'C': `copied`,
  'U': `umerged`,
  '?': `untracked`,
  '!': `ignored`
};
