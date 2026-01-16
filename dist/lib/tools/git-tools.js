"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitPushTool = exports.GitBranchTool = exports.GitCommitTool = exports.GitLogTool = exports.GitDiffTool = exports.GitAddTool = exports.GitStatusTool = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const simple_git_1 = __importDefault(require("simple-git"));
const git = (0, simple_git_1.default)();
/**
 * Get git status
 */
class GitStatusTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'git_status';
        this.description = 'Show the working tree status - staged, unstaged, and untracked files.';
        this.requiresConfirmation = false;
        this.destructive = false;
        this.schema = zod_1.z.object({});
    }
    async execute(params) {
        try {
            const status = await git.status();
            const output = [];
            output.push(`Branch: ${status.current || '(detached HEAD)'}`);
            output.push(`Ahead: ${status.ahead}, Behind: ${status.behind}`);
            if (status.files.length === 0) {
                output.push('\nWorking tree clean');
            }
            else {
                if (status.staged.length > 0) {
                    output.push('\nStaged files:');
                    status.staged.forEach(file => output.push(`  + ${file}`));
                }
                if (status.modified.length > 0 || status.deleted.length > 0) {
                    output.push('\nUnstaged changes:');
                    status.modified.forEach(file => output.push(`  M ${file}`));
                    status.deleted.forEach(file => output.push(`  D ${file}`));
                }
                if (status.not_added.length > 0) {
                    output.push('\nUntracked files:');
                    status.not_added.forEach(file => output.push(`  ? ${file}`));
                }
            }
            return this.success(output.join('\n'), { status });
        }
        catch (error) {
            return this.error(`Git status failed: ${error.message}`);
        }
    }
}
exports.GitStatusTool = GitStatusTool;
/**
 * Stage files for commit (git add)
 */
class GitAddTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'git_add';
        this.description = 'Stage files for commit. Use "." to stage all changes, or specify specific files.';
        this.requiresConfirmation = false;
        this.destructive = false;
        this.schema = zod_1.z.object({
            files: zod_1.z.array(zod_1.z.string()).describe('Files to stage. Use ["."] to stage all changes.')
        });
    }
    async execute(params) {
        try {
            await git.add(params.files);
            // Get status to show what was staged
            const status = await git.status();
            const stagedFiles = status.staged;
            return this.success(`Staged ${stagedFiles.length} file(s):\n${stagedFiles.map(f => `  + ${f}`).join('\n')}`, { staged: stagedFiles });
        }
        catch (error) {
            return this.error(`Git add failed: ${error.message}`);
        }
    }
}
exports.GitAddTool = GitAddTool;
/**
 * Show git diff
 */
class GitDiffTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'git_diff';
        this.description = 'Show changes in files. Can show staged or unstaged changes, or changes for specific files.';
        this.requiresConfirmation = false;
        this.destructive = false;
        this.schema = zod_1.z.object({
            files: zod_1.z.array(zod_1.z.string()).optional().describe('Specific files to show diff for'),
            staged: zod_1.z.boolean().optional().describe('Show staged changes (default: false, shows unstaged)')
        });
    }
    async execute(params) {
        try {
            const options = params.staged ? ['--cached'] : [];
            if (params.files && params.files.length > 0) {
                options.push('--', ...params.files);
            }
            const diff = await git.diff(options);
            if (!diff || diff.trim().length === 0) {
                return this.success('No changes to show');
            }
            return this.success(diff, { staged: params.staged || false });
        }
        catch (error) {
            return this.error(`Git diff failed: ${error.message}`);
        }
    }
}
exports.GitDiffTool = GitDiffTool;
/**
 * Show git log
 */
class GitLogTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'git_log';
        this.description = 'Show commit history with messages, authors, and dates.';
        this.requiresConfirmation = false;
        this.destructive = false;
        this.schema = zod_1.z.object({
            limit: zod_1.z.number().optional().describe('Maximum number of commits to show (default: 10)'),
            branch: zod_1.z.string().optional().describe('Branch to show log for (default: current branch)')
        });
    }
    async execute(params) {
        try {
            const options = {
                maxCount: params.limit || 10
            };
            if (params.branch) {
                options.file = params.branch;
            }
            const log = await git.log(options);
            const output = log.all.map(commit => {
                return `${commit.hash.substring(0, 7)} ${commit.date}\n  ${commit.message}`;
            }).join('\n\n');
            return this.success(output || 'No commits found', { count: log.all.length, commits: log.all });
        }
        catch (error) {
            return this.error(`Git log failed: ${error.message}`);
        }
    }
}
exports.GitLogTool = GitLogTool;
/**
 * Create a git commit
 */
class GitCommitTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'git_commit';
        this.description = 'Create a git commit with staged changes. Adds Claude attribution to commit message.';
        this.requiresConfirmation = true;
        this.destructive = true;
        this.schema = zod_1.z.object({
            message: zod_1.z.string().describe('Commit message'),
            files: zod_1.z.array(zod_1.z.string()).optional().describe('Files to stage before committing (if not already staged)')
        });
    }
    async execute(params) {
        try {
            // Stage files if specified
            if (params.files && params.files.length > 0) {
                await git.add(params.files);
            }
            // Add Claude attribution
            const fullMessage = `${params.message}\n\n🤖 Generated with CLI AI Tool\n\nCo-Authored-By: AI Assistant <noreply@example.com>`;
            // Create commit
            const result = await git.commit(fullMessage);
            return this.success(`Created commit: ${result.commit}\n${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`, { commit: result.commit, summary: result.summary });
        }
        catch (error) {
            return this.error(`Git commit failed: ${error.message}`);
        }
    }
}
exports.GitCommitTool = GitCommitTool;
/**
 * Manage git branches
 */
class GitBranchTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'git_branch';
        this.description = 'List, create, switch, or delete git branches.';
        this.requiresConfirmation = true;
        this.destructive = true;
        this.schema = zod_1.z.object({
            action: zod_1.z.enum(['list', 'create', 'switch', 'delete']).describe('Action to perform'),
            name: zod_1.z.string().optional().describe('Branch name (required for create, switch, delete)')
        });
    }
    async execute(params) {
        try {
            switch (params.action) {
                case 'list': {
                    const branches = await git.branchLocal();
                    const output = branches.all.map(branch => {
                        return branch === branches.current ? `* ${branch}` : `  ${branch}`;
                    }).join('\n');
                    return this.success(`Branches:\n${output}`, { current: branches.current, all: branches.all });
                }
                case 'create': {
                    if (!params.name) {
                        return this.error('Branch name is required for create action');
                    }
                    await git.checkoutLocalBranch(params.name);
                    return this.success(`Created and switched to branch: ${params.name}`);
                }
                case 'switch': {
                    if (!params.name) {
                        return this.error('Branch name is required for switch action');
                    }
                    await git.checkout(params.name);
                    return this.success(`Switched to branch: ${params.name}`);
                }
                case 'delete': {
                    if (!params.name) {
                        return this.error('Branch name is required for delete action');
                    }
                    await git.deleteLocalBranch(params.name);
                    return this.success(`Deleted branch: ${params.name}`);
                }
                default:
                    return this.error(`Unknown action: ${params.action}`);
            }
        }
        catch (error) {
            return this.error(`Git branch operation failed: ${error.message}`);
        }
    }
}
exports.GitBranchTool = GitBranchTool;
/**
 * Push to remote
 */
class GitPushTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'git_push';
        this.description = 'Push commits to remote repository. Use with caution, especially with force flag.';
        this.requiresConfirmation = true;
        this.destructive = true;
        this.schema = zod_1.z.object({
            branch: zod_1.z.string().optional().describe('Branch to push (default: current branch)'),
            force: zod_1.z.boolean().optional().describe('Force push (use with extreme caution, default: false)'),
            set_upstream: zod_1.z.boolean().optional().describe('Set upstream tracking (default: false)')
        });
    }
    async execute(params) {
        try {
            // Warn about force push to main/master
            if (params.force && (params.branch === 'main' || params.branch === 'master')) {
                return this.error('Force push to main/master branch is blocked for safety. ' +
                    'Please run this manually if absolutely necessary.');
            }
            const options = [];
            if (params.force) {
                options.push('--force');
            }
            if (params.set_upstream) {
                options.push('--set-upstream');
            }
            const remote = 'origin';
            const branch = params.branch || (await git.branchLocal()).current;
            await git.push(remote, branch, options);
            return this.success(`Pushed ${branch} to ${remote}${params.force ? ' (force)' : ''}`, { remote, branch, force: params.force || false });
        }
        catch (error) {
            return this.error(`Git push failed: ${error.message}`);
        }
    }
}
exports.GitPushTool = GitPushTool;
