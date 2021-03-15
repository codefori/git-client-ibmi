
const path = require(`path`);
const vscode = require(`vscode`);

const {instance} = vscode.extensions.getExtension(`halcyontechltd.code-for-ibmi`).exports;
const Git = require(`../api/git`);

module.exports = class Status {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.status = undefined;

    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration(`code-for-ibmi.connectionSettings`)) {
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
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);
        
        if (node) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            await repo.restore(node.path);
            this.refresh();
          }
        }
      }),

      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.uri.scheme === `streamfile`) {
          const connection = instance.getConnection();

          if (connection) {
            const repoPath = connection.config.homeDirectory;
            if (document.uri.path.startsWith(repoPath)) {
              this.refresh();
            }
          }
        }
      })
    );
  }

  refresh() {
    this.emitter.fire();
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
            items = this.status.staged.map(item => new StageFile(repoPath, item.path, item.state, `unstaged`));
            break;
          case `staged`:
            items = this.status.unstaged.map(item => new StageFile(repoPath, item.path, item.state, `staged`));
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