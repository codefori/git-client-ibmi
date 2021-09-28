const vscode = require(`vscode`);
const {instance} = vscode.extensions.getExtension(`halcyontechltd.code-for-ibmi`).exports;

module.exports = class Git {
  /**
   * @param {string} path Repo path
   */
  constructor(path) {
    this.path = path;

    /** @type {string|undefined} Path to git on remote */
    this.gitPath = undefined;
  }

  /**
   * Must be run when the class instance is created
   * @returns {boolean}
   */
  canUseGit() {
    const connection = instance.getConnection();
    this.gitPath = connection.remoteFeatures.git;
    return (this.gitPath ? true : false);
  }

  /**
   * Checks if the directory is a git repo
   * @returns {boolean}
   */
  async isGitRepo() {
    const connection = instance.getConnection();

    try {
      const result = await connection.paseCommand(`${this.gitPath} rev-parse --is-inside-work-tree`, this.path);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 
   * @param {number} [count]
   * @param {string} [file]
   * @returns {{hash: string, author: string, when: string, text: string}[]}
   */
  async getCommits(count = 50, file) {
    const connection = instance.getConnection();

    const result = await connection.paseCommand(`${this.gitPath} --no-pager log --max-count=${count} --pretty=format:"%h|%an|%ar|%s" ${file ? ` -- ${file}` : ``}`, this.path);

    //TODO: No changes message
    if (result === ``) return [];

    const resultLines = result.split(`\n`);
    let commits = [];

    let commit;
    for (let line of resultLines) {
      commit = line.split(`|`);
      commits.push({
        hash: commit[0],
        author: commit[1],
        when: commit[2],
        text: commit[3]
      });
    }

    return commits;
  }

  /**
   * Returns a list of files that changed for a commit
   * @param {string} hash 
   * @returns {{hash: string, path: string}[]}
   */
  async getChangesInCommit(hash) {
    const connection = instance.getConnection();

    const files = await connection.paseCommand(
      `${this.gitPath} diff-tree --no-commit-id --name-only -r ${hash}`,
      this.path,
    );

    const filesList = files.split(`\n`);

    let returnList = [];

    for (const path of filesList) {
      returnList.push({
        hash,
        path
      });
    }

    return returnList;
  }

  /**
   * Get contents of a file at a commit
   * @param {string} hash 
   * @param {string} relativePath
   * @returns {string}
   */
  async getFileContent(hash, relativePath) {
    const connection = instance.getConnection();

    const content = await connection.paseCommand(
      `${this.gitPath} show ${hash}:${relativePath}`,
      this.path,
    );

    return content;
  }

  /**
   * @returns {{staged: {path, state}[], unstaged: {path, state}[]}}
   */
  async status() {
    const connection = instance.getConnection();
    let staged = [], unstaged = [];

    let item = {path: ``, status: ``, state: []};
    let content = await connection.paseCommand(
      `echo '"' && ${this.gitPath} status --short`,
      this.path,
    );

    content = content.substring(1);

    for (let line of content.split(`\n`)) {
      if (line.trim() === ``) continue;
      
      item.status = line.substr(0, 2)
      item.state = item.status.split(``);
      item.path = line.substr(3);

      if (item.status === `??`) { // It's a new, untracked file
        unstaged.push({path: item.path, state: item.state[0]});

      } else {
        if (item.state[0] !== ` `) {
          staged.push({path: item.path, state: item.state[0]});
        }

        if (item.state[1] !== ` `) {
          unstaged.push({path: item.path, state: item.state[1]});
        }
      }
    }

    return {staged, unstaged};
  }

  /**
   * @param {string} path 
   */
  async stage(path) {
    const connection = instance.getConnection();

    await connection.paseCommand(
      `${this.gitPath} add ${path}`,
      this.path,
    );
  }

  /**
   * @param {string} path 
   */
  async unstage(path) {
    const connection = instance.getConnection();
    
    await connection.paseCommand(
      `${this.gitPath} reset -- ${path}`,
      this.path,
    );
  }

  /**
   * @param {string} path 
   */
  async restore(path) {
    const connection = instance.getConnection();
    
    await connection.paseCommand(
      `${this.gitPath} checkout -- ${path}`,
      this.path,
    );
  }

  /**
   * Make a commit
   * @param {string} message 
   */
  async commit(message) {
    const connection = instance.getConnection();

    message = message.replace(new RegExp(`"`, `g`), `\\"`);
    
    await connection.paseCommand(
      `${this.gitPath} commit -m "${message}"`,
      this.path,
    );
  }

  /**
   * Push commits
   */
  async push() {
    const connection = instance.getConnection();
    const branch = await this.getCurrentBranch();

    await connection.paseCommand(
      `${this.gitPath} push ${branch ? `origin ${branch}` : ``}`.trim(),
      this.path,
    );
  }

  /**
   * Pull commits
   */
  async pull() {
    const connection = instance.getConnection();

    await connection.paseCommand(
      `${this.gitPath} pull`,
      this.path,
    );
  }

  /**
   * Gets the current branch of the repo
   * @returns {string}
   */
  async getCurrentBranch() {
    const connection = instance.getConnection();
  
    try {
      const result = await connection.paseCommand(`${this.gitPath} rev-parse --abbrev-ref HEAD`, this.path);
      return result;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * @returns {remote: branch_name[], local: {branch_name, state}[]}}
   */
  async listBranches() {
    const connection = instance.getConnection();
    let remote = [], local = [];

    let item = {branch_name: ``, state: ``};
    let content = await connection.paseCommand(
      `echo '"' && ${this.gitPath} branch --all --list`,
      this.path,
    );

    content = content.substring(1);

    for (let line of content.split(`\n`)) {
      if (line.trim() === ``) continue;
      
      item.state = (line[0] == `*`) ? `checked out` : ``;
      item.branch_name = line.substr(2);
      const remote_or_local = (item.branch_name.split(`/`)[0] == `remotes`) ? `remote` : `local`;

      switch (remote_or_local) {
      case `remote`:
        remote.push(item.branch_name);
        break;
      case `local`:
        local.push({branch_name: item.branch_name, state: item.state});
        break;
      }
    }

    return {remote, local};
  }

  /**
   * Create a branch
   * @param {string} branchName Branch name to create
   */
  async createBranch(branchName) {
    const connection = instance.getConnection();
    await connection.paseCommand(
      `${this.gitPath} branch "${branchName}"`,
      this.path,
    );
  }

  /**
   * Delete a remote branch
   * @param {string} branchName Branch to delete
   * @param {string} branchLocation
   */
  async deleteBranch(branchName, branchLocation) {
    let result = await vscode.window.showWarningMessage(`Are you sure you want to delete branch ${branchName}?`, `Yes`, `Cancel`);

    if (result === `Yes`) {
      const connection = instance.getConnection();
      let command;

      if (branchLocation === `remote`) {
        const split_branch_to_delete = branchName.split(`/`);
        command = `${this.gitPath} push "${split_branch_to_delete[1]}" --delete "${split_branch_to_delete[2]}"`;
      } else {
        command = `${this.gitPath} branch -D "${branchName}"`;
      }

      await connection.paseCommand(
        command,
        this.path,
      );
    }
  }

  /**
   * Checkout a branch
   * @param {string} branchName Branch to checkout
   * @param {string} branchLocation 
   */
  async checkout(branchName, branchLocation) {
    const connection = instance.getConnection();

    let command;
    if (branchLocation === `remote`) {
      const split_branch_name = branchName.split(`/`);
      command = `${this.gitPath} checkout -b "${split_branch_name[2]}" "${split_branch_name[1]}"/"${split_branch_name[2]}"`;
    } else {
      command = `${this.gitPath} checkout "${branchName}"`;
    }

    await connection.paseCommand(
      command,
      this.path,
    );
  }

  /**
   * Merge a branch into the current branch
   * @param {string} branchName Branch to merge into current branch
   */
  async merge(branchName) {
    const connection = instance.getConnection();
    await connection.paseCommand(
      `${this.gitPath} merge "${branchName}"`,
      this.path,
    );
  }
}
