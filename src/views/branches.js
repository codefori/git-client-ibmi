
const vscode = require(`vscode`);
const {instance} = vscode.extensions.getExtension(`halcyontechltd.code-for-ibmi`).exports;
const Git = require(`../api/git`);

module.exports = class Branches {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.branch_list = undefined;

    this.emitter = new vscode.EventEmitter();

    context.subscriptions.push(
      vscode.commands.registerCommand(`git-client-ibmi.branches.refresh`, async () => {
        this.refresh();
      }),

      vscode.commands.registerCommand(`git-client-ibmi.branches.branch`, async () => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            const new_branch_name = await vscode.window.showInputBox({
              prompt: `New branch name`
            });

            if (new_branch_name) {
              try {
                await repo.create_branch(new_branch_name);
                await vscode.commands.executeCommand(`git-client-ibmi.branches.refresh`);
                await vscode.commands.executeCommand(`git-client-ibmi.commits.refresh`);
                vscode.window.showInformationMessage(`Branch created successfully.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error creating branch in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      //TODO: add delete branch option when right clicking branch within local branch view
      vscode.commands.registerCommand(`git-client-ibmi.branches.deleteLocalBranch`, async () => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            const local_branch_to_delete = await vscode.window.showInputBox({
              prompt: `Local branch to delete`
            });

            if (local_branch_to_delete) {
              try {
                await repo.deleteLocalBranch(local_branch_to_delete);
                await vscode.commands.executeCommand(`git-client-ibmi.branches.refresh`);
                await vscode.commands.executeCommand(`git-client-ibmi.commits.refresh`);
                vscode.window.showInformationMessage(`Local branch successfully deleted.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error deleting local branch in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      //TODO: add delete branch option when right clicking branch within remote branch view
      vscode.commands.registerCommand(`git-client-ibmi.branches.deleteRemoteBranch`, async () => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            const remote_to_delete_from = await vscode.window.showInputBox({
              prompt: `Remote name ("origin" by default)`
            });
            //TODO: add default value of "origin" if remote_to_delete_from is not specified.
            const remote_branch_to_delete = await vscode.window.showInputBox({
              prompt: `Remote branch to delete`
            });

            if (remote_to_delete_from && remote_branch_to_delete) {
              try {
                await repo.deleteRemoteBranch(remote_to_delete_from, remote_branch_to_delete);
                await vscode.commands.executeCommand(`git-client-ibmi.branches.refresh`);
                await vscode.commands.executeCommand(`git-client-ibmi.commits.refresh`);
                vscode.window.showInformationMessage(`Remote branch successfully deleted.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error deleting remote branch in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      //TODO: add checkout option when right clicking branch in branch view
      //TODO: update content of files already open when checking out new branch. how should we handle unsaved changes?
      vscode.commands.registerCommand(`git-client-ibmi.branches.checkout`, async () => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            const branch_to_checkout = await vscode.window.showInputBox({
              prompt: `Name of branch to checkout`
            });

            if (branch_to_checkout) {
              try {
                await repo.checkout(branch_to_checkout);
                await vscode.commands.executeCommand(`git-client-ibmi.branches.refresh`);
                await vscode.commands.executeCommand(`git-client-ibmi.commits.refresh`);
                vscode.window.showInformationMessage(`${branch_to_checkout} checked out successfully.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error creating branch in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      //TODO: add merge option when right clicking branch in branch view
      vscode.commands.registerCommand(`git-client-ibmi.branches.merge`, async () => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            const branch_to_merge_into_current_branch = await vscode.window.showInputBox({
              prompt: `Name of branch to merge into the current branch`
            });

            if (branch_to_merge_into_current_branch) {
              try {
                await repo.merge(branch_to_merge_into_current_branch);
                await vscode.commands.executeCommand(`git-client-ibmi.branches.refresh`);
                await vscode.commands.executeCommand(`git-client-ibmi.commits.refresh`);
                vscode.window.showInformationMessage(`${branch_to_merge_into_current_branch} successfully merged into current branch.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error merging branch in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration(`code-for-ibmi.connectionSettings`)) {
          this.refresh();
        }
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
   * @param {Branch} [element] 
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
          switch (element.contextValue) {
            case `remote_branches`:
              items = this.branch_list.remote.map(item => new Branch(item));
              break;
            case `local_branches`:
              items = this.branch_list.local.map(item => new Branch(item.branch_name, item.state));
              break;
            }
        } else {
          items = [
            new Subitem('Remote Branches', 'remote_branches'),
            new Subitem('Local Branches', 'local_branches')
          ]
        }

        try {
          const branch_list = await repo.list_branches();
          this.branch_list = branch_list;
        } catch (e) {
          items = [new vscode.TreeItem(`Error fetching branches for ${repoPath}`)];
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

class Branch extends vscode.TreeItem {
  /**
   * 
   * @param {string} branch_name 
   * @param {string} state //empty string by default. only one branch can have the value of "checked out" at a time.
   */
   constructor(branch_name, state = "") {
    super(branch_name, vscode.TreeItemCollapsibleState.None);

    this.branch_name = branch_name;
    this.state = state;

    //TODO: add icon for git-branch
    this.iconPath = new vscode.ThemeIcon(`git-commit`);

    //TODO: add remaining commands
    this.command = {
      command: 'git-client-ibmi.branches.checkout',
      title: 'Checkout',
      arguments: [branch_name]
    };
  }
}
