import { z } from 'zod';
import { Tool } from './base';
import { ToolResult } from '../../types';
import simpleGit, { SimpleGit } from 'simple-git';

const git: SimpleGit = simpleGit();

/**
 * Get git status
 */
export class GitStatusTool extends Tool {
    name = 'git_status';
    description = 'Show the working tree status - staged, unstaged, and untracked files.';
    requiresConfirmation = false;
    destructive = false;

    schema = z.object({});

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            const status = await git.status();

            const output = [];
            output.push(`Branch: ${status.current || '(detached HEAD)'}`);
            output.push(`Ahead: ${status.ahead}, Behind: ${status.behind}`);

            if (status.files.length === 0) {
                output.push('\nWorking tree clean');
            } else {
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
        } catch (error: any) {
            return this.error(`Git status failed: ${error.message}`);
        }
    }
}

/**
 * Stage files for commit (git add)
 */
export class GitAddTool extends Tool {
    name = 'git_add';
    description = 'Stage files for commit. Use "." to stage all changes, or specify specific files.';
    requiresConfirmation = false;
    destructive = false;

    schema = z.object({
        files: z.array(z.string()).describe('Files to stage. Use ["."] to stage all changes.')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            await git.add(params.files);

            // Get status to show what was staged
            const status = await git.status();
            const stagedFiles = status.staged;

            return this.success(
                `Staged ${stagedFiles.length} file(s):\n${stagedFiles.map(f => `  + ${f}`).join('\n')}`,
                { staged: stagedFiles }
            );
        } catch (error: any) {
            return this.error(`Git add failed: ${error.message}`);
        }
    }
}

/**
 * Show git diff
 */
export class GitDiffTool extends Tool {
    name = 'git_diff';
    description = 'Show changes in files. Can show staged or unstaged changes, or changes for specific files.';
    requiresConfirmation = false;
    destructive = false;

    schema = z.object({
        files: z.array(z.string()).optional().describe('Specific files to show diff for'),
        staged: z.boolean().optional().describe('Show staged changes (default: false, shows unstaged)')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
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
        } catch (error: any) {
            return this.error(`Git diff failed: ${error.message}`);
        }
    }
}

/**
 * Show git log
 */
export class GitLogTool extends Tool {
    name = 'git_log';
    description = 'Show commit history with messages, authors, and dates.';
    requiresConfirmation = false;
    destructive = false;

    schema = z.object({
        limit: z.number().optional().describe('Maximum number of commits to show (default: 10)'),
        branch: z.string().optional().describe('Branch to show log for (default: current branch)')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            const options: any = {
                maxCount: params.limit || 10
            };

            if (params.branch) {
                options.file = params.branch;
            }

            const log = await git.log(options);

            const output = log.all.map(commit => {
                return `${commit.hash.substring(0, 7)} ${commit.date}\n  ${commit.message}`;
            }).join('\n\n');

            return this.success(
                output || 'No commits found',
                { count: log.all.length, commits: log.all }
            );
        } catch (error: any) {
            return this.error(`Git log failed: ${error.message}`);
        }
    }
}

/**
 * Create a git commit
 */
export class GitCommitTool extends Tool {
    name = 'git_commit';
    description = 'Create a git commit with staged changes. Adds Claude attribution to commit message.';
    requiresConfirmation = true;
    destructive = true;

    schema = z.object({
        message: z.string().describe('Commit message'),
        files: z.array(z.string()).optional().describe('Files to stage before committing (if not already staged)')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            // Stage files if specified
            if (params.files && params.files.length > 0) {
                await git.add(params.files);
            }

            // Add Claude attribution
            const fullMessage = `${params.message}\n\n🤖 Generated with CLI AI Tool\n\nCo-Authored-By: AI Assistant <noreply@example.com>`;

            // Create commit
            const result = await git.commit(fullMessage);

            return this.success(
                `Created commit: ${result.commit}\n${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`,
                { commit: result.commit, summary: result.summary }
            );
        } catch (error: any) {
            return this.error(`Git commit failed: ${error.message}`);
        }
    }
}

/**
 * Manage git branches
 */
export class GitBranchTool extends Tool {
    name = 'git_branch';
    description = 'List, create, switch, or delete git branches.';
    requiresConfirmation = true;
    destructive = true;

    schema = z.object({
        action: z.enum(['list', 'create', 'switch', 'delete']).describe('Action to perform'),
        name: z.string().optional().describe('Branch name (required for create, switch, delete)')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            switch (params.action) {
                case 'list': {
                    const branches = await git.branchLocal();
                    const output = branches.all.map(branch => {
                        return branch === branches.current ? `* ${branch}` : `  ${branch}`;
                    }).join('\n');
                    return this.success(
                        `Branches:\n${output}`,
                        { current: branches.current, all: branches.all }
                    );
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
        } catch (error: any) {
            return this.error(`Git branch operation failed: ${error.message}`);
        }
    }
}

/**
 * Push to remote
 */
export class GitPushTool extends Tool {
    name = 'git_push';
    description = 'Push commits to remote repository. Use with caution, especially with force flag.';
    requiresConfirmation = true;
    destructive = true;

    schema = z.object({
        branch: z.string().optional().describe('Branch to push (default: current branch)'),
        force: z.boolean().optional().describe('Force push (use with extreme caution, default: false)'),
        set_upstream: z.boolean().optional().describe('Set upstream tracking (default: false)')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            // Warn about force push to main/master
            if (params.force && (params.branch === 'main' || params.branch === 'master')) {
                return this.error(
                    'Force push to main/master branch is blocked for safety. ' +
                    'Please run this manually if absolutely necessary.'
                );
            }

            const options: string[] = [];
            if (params.force) {
                options.push('--force');
            }
            if (params.set_upstream) {
                options.push('--set-upstream');
            }

            const remote = 'origin';
            const branch = params.branch || (await git.branchLocal()).current;

            await git.push(remote, branch, options);

            return this.success(
                `Pushed ${branch} to ${remote}${params.force ? ' (force)' : ''}`,
                { remote, branch, force: params.force || false }
            );
        } catch (error: any) {
            return this.error(`Git push failed: ${error.message}`);
        }
    }
}
