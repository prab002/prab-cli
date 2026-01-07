import { z } from 'zod';
import { Tool } from './base';
import { ToolResult } from '../../types';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { diffLines } from 'diff';

/**
 * Read a file with line numbers
 */
export class ReadFileTool extends Tool {
    name = 'read_file';
    description = 'Read the contents of a file with line numbers. Supports pagination for large files.';
    requiresConfirmation = false;
    destructive = false;

    schema = z.object({
        file_path: z.string().describe('Absolute or relative path to the file to read'),
        offset: z.number().optional().describe('Line number to start reading from (1-indexed)'),
        limit: z.number().optional().describe('Maximum number of lines to read')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            const filePath = path.resolve(params.file_path);

            if (!fs.existsSync(filePath)) {
                return this.error(`File not found: ${params.file_path}`);
            }

            if (fs.statSync(filePath).isDirectory()) {
                return this.error(`Path is a directory: ${params.file_path}`);
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            const startLine = params.offset ? params.offset - 1 : 0;
            const endLine = params.limit ? startLine + params.limit : lines.length;
            const selectedLines = lines.slice(startLine, endLine);

            // Format with line numbers (1-indexed)
            const numberedLines = selectedLines.map((line, idx) => {
                const lineNum = startLine + idx + 1;
                return `${lineNum.toString().padStart(6)}→${line}`;
            }).join('\n');

            const totalLines = lines.length;
            const showing = `Showing lines ${startLine + 1}-${Math.min(endLine, totalLines)} of ${totalLines}`;

            return this.success(
                `${params.file_path}\n${showing}\n\n${numberedLines}`,
                { totalLines, startLine: startLine + 1, endLine: Math.min(endLine, totalLines) }
            );
        } catch (error: any) {
            return this.error(`Failed to read file: ${error.message}`);
        }
    }
}

/**
 * Write content to a file (create or overwrite)
 */
export class WriteFileTool extends Tool {
    name = 'write_file';
    description = 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does. Creates parent directories as needed.';
    requiresConfirmation = true;
    destructive = true;

    schema = z.object({
        file_path: z.string().describe('Absolute or relative path to the file to write'),
        content: z.string().describe('Content to write to the file')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            const filePath = path.resolve(params.file_path);
            const dir = path.dirname(filePath);

            // Create parent directories if needed
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const fileExists = fs.existsSync(filePath);
            fs.writeFileSync(filePath, params.content, 'utf-8');

            const action = fileExists ? 'Updated' : 'Created';
            const lines = params.content.split('\n').length;

            return this.success(
                `${action} ${params.file_path} (${lines} lines)`,
                { action, path: filePath, lines }
            );
        } catch (error: any) {
            return this.error(`Failed to write file: ${error.message}`);
        }
    }
}

/**
 * Edit a file by finding and replacing text
 */
export class EditFileTool extends Tool {
    name = 'edit_file';
    description = 'Edit a file by finding and replacing text. Shows a diff preview. Supports replace all option.';
    requiresConfirmation = true;
    destructive = true;

    schema = z.object({
        file_path: z.string().describe('Absolute or relative path to the file to edit'),
        search: z.string().describe('Text to search for (exact match)'),
        replace: z.string().describe('Text to replace with'),
        replace_all: z.boolean().optional().describe('Replace all occurrences (default: false)')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            const filePath = path.resolve(params.file_path);

            if (!fs.existsSync(filePath)) {
                return this.error(`File not found: ${params.file_path}`);
            }

            const originalContent = fs.readFileSync(filePath, 'utf-8');

            // Perform replacement
            let newContent: string;
            if (params.replace_all) {
                newContent = originalContent.split(params.search).join(params.replace);
            } else {
                newContent = originalContent.replace(params.search, params.replace);
            }

            if (originalContent === newContent) {
                return this.error(`Search text not found in file: "${params.search}"`);
            }

            // Generate diff
            const diff = diffLines(originalContent, newContent);
            const diffOutput = diff.map(part => {
                const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
                return part.value.split('\n').map(line => line ? prefix + line : '').join('\n');
            }).join('');

            // Write the changes
            fs.writeFileSync(filePath, newContent, 'utf-8');

            const occurrences = params.replace_all
                ? originalContent.split(params.search).length - 1
                : 1;

            return this.success(
                `Edited ${params.file_path} (${occurrences} replacement${occurrences > 1 ? 's' : ''})\n\nDiff:\n${diffOutput}`,
                { occurrences, path: filePath }
            );
        } catch (error: any) {
            return this.error(`Failed to edit file: ${error.message}`);
        }
    }
}

/**
 * Find files matching a glob pattern
 */
export class GlobTool extends Tool {
    name = 'glob';
    description = 'Find files matching a glob pattern (e.g., "**/*.ts", "src/**/*.js"). Returns paths sorted by modification time.';
    requiresConfirmation = false;
    destructive = false;

    schema = z.object({
        pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts")'),
        path: z.string().optional().describe('Directory to search in (default: current directory)')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            const cwd = params.path ? path.resolve(params.path) : process.cwd();
            const ignore = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.env', '**/*.lock'];

            const files = await glob(params.pattern, {
                cwd,
                ignore,
                nodir: true
            });

            // Sort by modification time (most recent first)
            const filesWithStats = files.map(file => {
                const fullPath = path.join(cwd, file);
                const stats = fs.statSync(fullPath);
                return { file, mtime: stats.mtime.getTime() };
            });

            filesWithStats.sort((a, b) => b.mtime - a.mtime);
            const sortedFiles = filesWithStats.map(f => f.file);

            if (sortedFiles.length === 0) {
                return this.success(`No files found matching pattern: ${params.pattern}`);
            }

            const output = sortedFiles.join('\n');
            return this.success(
                `Found ${sortedFiles.length} file(s) matching "${params.pattern}":\n${output}`,
                { count: sortedFiles.length, files: sortedFiles }
            );
        } catch (error: any) {
            return this.error(`Glob search failed: ${error.message}`);
        }
    }
}

/**
 * Search file contents with regex
 */
export class GrepTool extends Tool {
    name = 'grep';
    description = 'Search file contents using regex patterns. Supports multiple output modes and context lines.';
    requiresConfirmation = false;
    destructive = false;

    schema = z.object({
        pattern: z.string().describe('Regular expression pattern to search for'),
        path: z.string().optional().describe('Directory or file to search in (default: current directory)'),
        glob_filter: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts")'),
        output_mode: z.enum(['content', 'files', 'count']).optional().describe('Output mode: content (matching lines), files (file paths), count (match counts)'),
        case_insensitive: z.boolean().optional().describe('Case insensitive search (default: false)'),
        context_lines: z.number().optional().describe('Number of context lines to show before and after matches')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            const searchPath = params.path ? path.resolve(params.path) : process.cwd();
            const outputMode = params.output_mode || 'files';

            // Determine files to search
            let filesToSearch: string[];
            if (fs.existsSync(searchPath) && fs.statSync(searchPath).isFile()) {
                filesToSearch = [searchPath];
            } else {
                const globPattern = params.glob_filter || '**/*';
                const ignore = ['**/node_modules/**', '**/.git/**', '**/dist/**'];
                filesToSearch = await glob(globPattern, {
                    cwd: searchPath,
                    ignore,
                    nodir: true,
                    absolute: true
                });
            }

            // Create regex
            const flags = params.case_insensitive ? 'gi' : 'g';
            const regex = new RegExp(params.pattern, flags);

            const results: { file: string; matches: Array<{ line: number; content: string; }> }[] = [];

            // Search files
            for (const file of filesToSearch) {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const lines = content.split('\n');
                    const matches: Array<{ line: number; content: string }> = [];

                    lines.forEach((line, idx) => {
                        if (regex.test(line)) {
                            matches.push({ line: idx + 1, content: line });
                        }
                        // Reset regex lastIndex for global flag
                        regex.lastIndex = 0;
                    });

                    if (matches.length > 0) {
                        results.push({ file, matches });
                    }
                } catch (e) {
                    // Skip files that can't be read (binary, permissions, etc.)
                    continue;
                }
            }

            // Format output based on mode
            if (outputMode === 'files') {
                const fileList = results.map(r => r.file).join('\n');
                return this.success(
                    `Found matches in ${results.length} file(s):\n${fileList}`,
                    { count: results.length, files: results.map(r => r.file) }
                );
            } else if (outputMode === 'count') {
                const counts = results.map(r => `${r.file}: ${r.matches.length} matches`).join('\n');
                const total = results.reduce((sum, r) => sum + r.matches.length, 0);
                return this.success(
                    `Total matches: ${total}\n${counts}`,
                    { total, breakdown: results.map(r => ({ file: r.file, count: r.matches.length })) }
                );
            } else {
                // content mode
                const contextLines = params.context_lines || 0;
                let output = '';

                for (const result of results) {
                    output += `\n${result.file}:\n`;
                    for (const match of result.matches) {
                        output += `  ${match.line}: ${match.content}\n`;
                    }
                }

                return this.success(
                    `Found ${results.reduce((sum, r) => sum + r.matches.length, 0)} match(es) across ${results.length} file(s):${output}`,
                    { matchCount: results.reduce((sum, r) => sum + r.matches.length, 0), fileCount: results.length }
                );
            }
        } catch (error: any) {
            return this.error(`Grep search failed: ${error.message}`);
        }
    }
}
