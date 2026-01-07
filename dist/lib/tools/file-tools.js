"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrepTool = exports.GlobTool = exports.EditFileTool = exports.WriteFileTool = exports.ReadFileTool = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
const diff_1 = require("diff");
/**
 * Read a file with line numbers
 */
class ReadFileTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'read_file';
        this.description = 'Read the contents of a file with line numbers. Supports pagination for large files.';
        this.requiresConfirmation = false;
        this.destructive = false;
        this.schema = zod_1.z.object({
            file_path: zod_1.z.string().describe('Absolute or relative path to the file to read'),
            offset: zod_1.z.number().optional().describe('Line number to start reading from (1-indexed)'),
            limit: zod_1.z.number().optional().describe('Maximum number of lines to read')
        });
    }
    async execute(params) {
        try {
            const filePath = path_1.default.resolve(params.file_path);
            if (!fs_1.default.existsSync(filePath)) {
                return this.error(`File not found: ${params.file_path}`);
            }
            if (fs_1.default.statSync(filePath).isDirectory()) {
                return this.error(`Path is a directory: ${params.file_path}`);
            }
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
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
            return this.success(`${params.file_path}\n${showing}\n\n${numberedLines}`, { totalLines, startLine: startLine + 1, endLine: Math.min(endLine, totalLines) });
        }
        catch (error) {
            return this.error(`Failed to read file: ${error.message}`);
        }
    }
}
exports.ReadFileTool = ReadFileTool;
/**
 * Write content to a file (create or overwrite)
 */
class WriteFileTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'write_file';
        this.description = 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does. Creates parent directories as needed.';
        this.requiresConfirmation = true;
        this.destructive = true;
        this.schema = zod_1.z.object({
            file_path: zod_1.z.string().describe('Absolute or relative path to the file to write'),
            content: zod_1.z.string().describe('Content to write to the file')
        });
    }
    async execute(params) {
        try {
            const filePath = path_1.default.resolve(params.file_path);
            const dir = path_1.default.dirname(filePath);
            // Create parent directories if needed
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            const fileExists = fs_1.default.existsSync(filePath);
            fs_1.default.writeFileSync(filePath, params.content, 'utf-8');
            const action = fileExists ? 'Updated' : 'Created';
            const lines = params.content.split('\n').length;
            return this.success(`${action} ${params.file_path} (${lines} lines)`, { action, path: filePath, lines });
        }
        catch (error) {
            return this.error(`Failed to write file: ${error.message}`);
        }
    }
}
exports.WriteFileTool = WriteFileTool;
/**
 * Edit a file by finding and replacing text
 */
class EditFileTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'edit_file';
        this.description = 'Edit a file by finding and replacing text. Shows a diff preview. Supports replace all option.';
        this.requiresConfirmation = true;
        this.destructive = true;
        this.schema = zod_1.z.object({
            file_path: zod_1.z.string().describe('Absolute or relative path to the file to edit'),
            search: zod_1.z.string().describe('Text to search for (exact match)'),
            replace: zod_1.z.string().describe('Text to replace with'),
            replace_all: zod_1.z.boolean().optional().describe('Replace all occurrences (default: false)')
        });
    }
    async execute(params) {
        try {
            const filePath = path_1.default.resolve(params.file_path);
            if (!fs_1.default.existsSync(filePath)) {
                return this.error(`File not found: ${params.file_path}`);
            }
            const originalContent = fs_1.default.readFileSync(filePath, 'utf-8');
            // Perform replacement
            let newContent;
            if (params.replace_all) {
                newContent = originalContent.split(params.search).join(params.replace);
            }
            else {
                newContent = originalContent.replace(params.search, params.replace);
            }
            if (originalContent === newContent) {
                return this.error(`Search text not found in file: "${params.search}"`);
            }
            // Generate diff
            const diff = (0, diff_1.diffLines)(originalContent, newContent);
            const diffOutput = diff.map(part => {
                const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
                return part.value.split('\n').map(line => line ? prefix + line : '').join('\n');
            }).join('');
            // Write the changes
            fs_1.default.writeFileSync(filePath, newContent, 'utf-8');
            const occurrences = params.replace_all
                ? originalContent.split(params.search).length - 1
                : 1;
            return this.success(`Edited ${params.file_path} (${occurrences} replacement${occurrences > 1 ? 's' : ''})\n\nDiff:\n${diffOutput}`, { occurrences, path: filePath });
        }
        catch (error) {
            return this.error(`Failed to edit file: ${error.message}`);
        }
    }
}
exports.EditFileTool = EditFileTool;
/**
 * Find files matching a glob pattern
 */
class GlobTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'glob';
        this.description = 'Find files matching a glob pattern (e.g., "**/*.ts", "src/**/*.js"). Returns paths sorted by modification time.';
        this.requiresConfirmation = false;
        this.destructive = false;
        this.schema = zod_1.z.object({
            pattern: zod_1.z.string().describe('Glob pattern to match files (e.g., "**/*.ts")'),
            path: zod_1.z.string().optional().describe('Directory to search in (default: current directory)')
        });
    }
    async execute(params) {
        try {
            const cwd = params.path ? path_1.default.resolve(params.path) : process.cwd();
            const ignore = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.env', '**/*.lock'];
            const files = await (0, glob_1.glob)(params.pattern, {
                cwd,
                ignore,
                nodir: true
            });
            // Sort by modification time (most recent first)
            const filesWithStats = files.map(file => {
                const fullPath = path_1.default.join(cwd, file);
                const stats = fs_1.default.statSync(fullPath);
                return { file, mtime: stats.mtime.getTime() };
            });
            filesWithStats.sort((a, b) => b.mtime - a.mtime);
            const sortedFiles = filesWithStats.map(f => f.file);
            if (sortedFiles.length === 0) {
                return this.success(`No files found matching pattern: ${params.pattern}`);
            }
            const output = sortedFiles.join('\n');
            return this.success(`Found ${sortedFiles.length} file(s) matching "${params.pattern}":\n${output}`, { count: sortedFiles.length, files: sortedFiles });
        }
        catch (error) {
            return this.error(`Glob search failed: ${error.message}`);
        }
    }
}
exports.GlobTool = GlobTool;
/**
 * Search file contents with regex
 */
class GrepTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'grep';
        this.description = 'Search file contents using regex patterns. Supports multiple output modes and context lines.';
        this.requiresConfirmation = false;
        this.destructive = false;
        this.schema = zod_1.z.object({
            pattern: zod_1.z.string().describe('Regular expression pattern to search for'),
            path: zod_1.z.string().optional().describe('Directory or file to search in (default: current directory)'),
            glob_filter: zod_1.z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts")'),
            output_mode: zod_1.z.enum(['content', 'files', 'count']).optional().describe('Output mode: content (matching lines), files (file paths), count (match counts)'),
            case_insensitive: zod_1.z.boolean().optional().describe('Case insensitive search (default: false)'),
            context_lines: zod_1.z.number().optional().describe('Number of context lines to show before and after matches')
        });
    }
    async execute(params) {
        try {
            const searchPath = params.path ? path_1.default.resolve(params.path) : process.cwd();
            const outputMode = params.output_mode || 'files';
            // Determine files to search
            let filesToSearch;
            if (fs_1.default.existsSync(searchPath) && fs_1.default.statSync(searchPath).isFile()) {
                filesToSearch = [searchPath];
            }
            else {
                const globPattern = params.glob_filter || '**/*';
                const ignore = ['**/node_modules/**', '**/.git/**', '**/dist/**'];
                filesToSearch = await (0, glob_1.glob)(globPattern, {
                    cwd: searchPath,
                    ignore,
                    nodir: true,
                    absolute: true
                });
            }
            // Create regex
            const flags = params.case_insensitive ? 'gi' : 'g';
            const regex = new RegExp(params.pattern, flags);
            const results = [];
            // Search files
            for (const file of filesToSearch) {
                try {
                    const content = fs_1.default.readFileSync(file, 'utf-8');
                    const lines = content.split('\n');
                    const matches = [];
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
                }
                catch (e) {
                    // Skip files that can't be read (binary, permissions, etc.)
                    continue;
                }
            }
            // Format output based on mode
            if (outputMode === 'files') {
                const fileList = results.map(r => r.file).join('\n');
                return this.success(`Found matches in ${results.length} file(s):\n${fileList}`, { count: results.length, files: results.map(r => r.file) });
            }
            else if (outputMode === 'count') {
                const counts = results.map(r => `${r.file}: ${r.matches.length} matches`).join('\n');
                const total = results.reduce((sum, r) => sum + r.matches.length, 0);
                return this.success(`Total matches: ${total}\n${counts}`, { total, breakdown: results.map(r => ({ file: r.file, count: r.matches.length })) });
            }
            else {
                // content mode
                const contextLines = params.context_lines || 0;
                let output = '';
                for (const result of results) {
                    output += `\n${result.file}:\n`;
                    for (const match of result.matches) {
                        output += `  ${match.line}: ${match.content}\n`;
                    }
                }
                return this.success(`Found ${results.reduce((sum, r) => sum + r.matches.length, 0)} match(es) across ${results.length} file(s):${output}`, { matchCount: results.reduce((sum, r) => sum + r.matches.length, 0), fileCount: results.length });
            }
        }
        catch (error) {
            return this.error(`Grep search failed: ${error.message}`);
        }
    }
}
exports.GrepTool = GrepTool;
