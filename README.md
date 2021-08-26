# git-client-ibmi README

This is a git client that works on the remote server, for specifically IBM i. Please raise issues on the [Code for IBM i](https://github.com/halcyon-tech/code-for-ibmi) repository. We are open to PRs.

## Requirements

This extension depends on [Code for IBM i](https://github.com/halcyon-tech/code-for-ibmi).

## Features

This adds 'Status', 'Commits' and 'File History' to the source control view. It will assume that your home directory, set in Code for IBM i is also a git repository. When you change your home directory, the panels will refresh automatically.

#### Branches

This view will display remote and local branches and allow you to create, delete, checkout, and merge branches. 

#### Status

This view will allow you to commit, pull, push, stage, unstage, restore and view a diff of your working tree.

#### Commits

Commit history of your repository.

#### File History

History of changes of the file that is currently being worked on. Will refresh automatically when you switch between files.