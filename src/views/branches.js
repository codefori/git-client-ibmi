
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
    this.onDidChangeTreeData = this.emitter.event;

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
                await repo.createBranch(new_branch_name);
                vscode.window.showInformationMessage(`Branch created successfully.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error creating branch in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      vscode.commands.registerCommand(`git-client-ibmi.branches.deleteBranch`, async (node) => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            let branch_to_delete, branchLocation;

            if (!node) {
              branch_to_delete = await vscode.window.showInputBox({
                prompt: `Branch to delete`
              });
              branchLocation = null;
            } else {
              branch_to_delete = node.branch_name;
              branchLocation = node.contextValue;
            }

            if (branch_to_delete) {
              try {
                await repo.deleteBranch(branch_to_delete, branchLocation);
                vscode.window.showInformationMessage(`Branch successfully deleted.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error deleting branch in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      //TODO: refresh content of files already open when checking out different branch. how should we handle unsaved changes?
      vscode.commands.registerCommand(`git-client-ibmi.branches.checkout`, async (node) => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            let branch_to_checkout, branchLocation;

            if (!node){
              branch_to_checkout = await vscode.window.showInputBox({
                prompt: `Name of branch to checkout`
              });
              branchLocation = null;
            }
            else{
              branch_to_checkout = node.branch_name;
              branchLocation = node.contextValue;
            }

            if (branch_to_checkout) {
              try {
                await repo.checkout(branch_to_checkout, branchLocation);
                await vscode.commands.executeCommand(`git-client-ibmi.commits.refresh`);
                vscode.window.showInformationMessage(`${branch_to_checkout} checked out successfully.`);
              } catch (e) {
                vscode.window.showErrorMessage(`Error checking out branch in ${repoPath}. ${e}`);
              }

              this.refresh();
            }
          }
        }
      }),

      vscode.commands.registerCommand(`git-client-ibmi.branches.merge`, async (node) => {
        const connection = instance.getConnection();
        const repoPath = connection.config.homeDirectory;
        const repo = new Git(repoPath);

        if (connection) {
          if (repo.canUseGit() && await repo.isGitRepo()) {
            let branch_to_merge_into_current_branch;
            if (!node){
              branch_to_merge_into_current_branch = await vscode.window.showInputBox({
                prompt: `Name of branch to merge into the current branch`
              });
            }
            else{
              branch_to_merge_into_current_branch = node.branch_name;
            }

            if (branch_to_merge_into_current_branch) {
              try {
                await repo.merge(branch_to_merge_into_current_branch);
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
            items = this.branch_list.remote.map(item => new Branch(item, `remote`));
            items.contextValue = `remotes`;
            break;
          case `local_branches`:
            items = this.branch_list.local.map(item => new Branch(item.branch_name, `local`, item.state));
            break;
          }
        } else {
          items = [
            new Subitem(`Remote Branches`, `remote_branches`),
            new Subitem(`Local Branches`, `local_branches`)
          ]
        }

        try {
          this.branch_list = await repo.listBranch();
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
   * @param {contextValue} contextValue
   */
  constructor(branch_name, contextValue, state = ``) {
    super(branch_name, vscode.TreeItemCollapsibleState.None);

    this.branch_name = branch_name;
    this.contextValue = contextValue;
    this.description = state; //only one branch should have the description of "checked out" at a time

    this.iconPath = new vscode.ThemeIcon(`git-branch`);
  }
}
