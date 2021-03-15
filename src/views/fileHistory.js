
const vscode = require(`vscode`);
const {instance} = vscode.extensions.getExtension(`halcyontechltd.code-for-ibmi`).exports;
const Git = require(`../api/git`);

module.exports = class fileHistory {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    /** @type {string|undefined} */
    this.currentFile = undefined;

    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;

    context.subscriptions.push(
      vscode.commands.registerCommand(`git-client-ibmi.fileChanges.refresh`, async () => {
        this.refresh();
      }),

      vscode.window.onDidChangeActiveTextEditor((editor) => {
        const doc = editor.document;
        if (doc.uri.scheme === `streamfile`) {
          const connection = instance.getConnection();

          if (connection) {
            const repoPath = connection.config.homeDirectory;
            const relativePath = doc.uri.path.substring(connection.config.homeDirectory.length+1);

            this.currentFile = relativePath;
            this.refresh();
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

        try {
          const commits = await repo.getCommits(20, this.currentFile);
          items = commits.map(commit => new Commit(repoPath, commit.hash, commit.text, commit.when, commit.author, this.currentFile));
        } catch (e) {
          items = [new vscode.TreeItem(`Error fetching commits for ${repoPath}`)];
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


class Commit extends vscode.TreeItem {
  /**
   * 
   * @param {string} repo 
   * @param {string} hash 
   * @param {string} text 
   * @param {string} when
   * @param {string} author
   * @param {string} relativePath
   */
  constructor(repo, hash, text, when, author, relativePath) {
    super(text, vscode.TreeItemCollapsibleState.None);

    this.path = hash;
    this.author = author;
    this.relativePath = relativePath;

    this.tooltip = text;
    this.description = `${author}, ${when}`;

    this.command = {
      command: `git-client-ibmi.viewCommitFileDiff`,
      title: `View diff`,
      arguments: [repo, hash, relativePath]
    };

    this.iconPath = new vscode.ThemeIcon(`git-commit`);
  }
}