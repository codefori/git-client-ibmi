
const vscode = require(`vscode`);
const {instance} = vscode.extensions.getExtension(`halcyontechltd.code-for-ibmi`).exports;
const Git = require(`../api/git`);

module.exports = class Commits {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;

    context.subscriptions.push(
      vscode.commands.registerCommand(`git-client-ibmi.commits.refresh`, async () => {
        this.refresh();
      }),

      vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration(`code-for-ibmi.connectionSettings`)) {
          this.refresh();
        }
      }),
      
      vscode.commands.registerCommand(`git-client-ibmi.viewCommitFileDiff`, async (repoPath, hash, relativePath) => {
        const commitUri = vscode.Uri.parse([repoPath, hash, relativePath].join(`|`)).with({scheme: `commitFile`});
        const commitUriMinusOne = vscode.Uri.parse([repoPath, `${hash}~1`, relativePath].join(`|`)).with({scheme: `commitFile`});

        vscode.commands.executeCommand(`vscode.diff`, commitUriMinusOne, commitUri);
      }),
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
    const connection = instance.getConnection();

    /** @type {vscode.TreeItem[]} */
    let items = [];

    if (connection) {
      const repoPath = connection.config.homeDirectory;
      const repo = new Git(repoPath);

      if (repo.canUseGit() && await repo.isGitRepo()) {

        if (element) {
          //Means fetch files in the commit later
          try {
            const files = await repo.getChangesInCommit(element.path);
            items = files.map(file => new CommitFile(repoPath, file.hash, file.path));
          } catch (e) {
            items = [new vscode.TreeItem(`Error fetching files for ${repoPath}:${element.path}`)];
          }
          

        } else {
          try {
            const commits = await repo.getCommits(20);
            items = commits.map(commit => new Commit(commit.hash, commit.text, commit.when, commit.author));
          } catch (e) {
            items = [new vscode.TreeItem(`Error fetching commits for ${repoPath}`)];
          }
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
   * @param {string} hash 
   * @param {string} text 
   * @param {string} when
   * @param {string} author
   */
  constructor(hash, text, when, author) {
    super(text, vscode.TreeItemCollapsibleState.Collapsed);

    this.path = hash;
    this.author = author;

    this.tooltip = text;
    this.description = `${author}, ${when}`;

    this.iconPath = new vscode.ThemeIcon(`git-commit`);
  }
}

class CommitFile extends vscode.TreeItem {
  /**
   * @param {string} repo
   * @param {string} hash
   * @param {string} relativePath
   */
  constructor(repo, hash, relativePath) {
    super(relativePath, vscode.TreeItemCollapsibleState.None);

    this.repoPath = repo;
    this.hash = hash;
    this.relativePath = relativePath;

    this.contextValue = `commitFile`;

    this.command = {
      command: `git-client-ibmi.viewCommitFileDiff`,
      title: `View diff`,
      arguments: [repo, hash, relativePath]
    };

    this.iconPath = new vscode.ThemeIcon(`symbol-file`);
  }
}