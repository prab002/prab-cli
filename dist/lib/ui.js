"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamFormatter = exports.formatMarkdown = exports.showToolProgress = exports.showTodoList = exports.showDiff = exports.banner = exports.log = void 0;
const chalk_1 = __importDefault(require("chalk"));
const diff_1 = require("diff");
// Syntax highlighting color schemes for different languages
const syntaxColors = {
    keyword: chalk_1.default.magenta,
    string: chalk_1.default.green,
    number: chalk_1.default.yellow,
    comment: chalk_1.default.gray,
    function: chalk_1.default.cyan,
    variable: chalk_1.default.white,
    operator: chalk_1.default.yellow,
    punctuation: chalk_1.default.white,
    type: chalk_1.default.blue,
};
// Common keywords for different languages
const keywords = new Set([
    // JavaScript/TypeScript
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
    'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw',
    'class', 'extends', 'new', 'this', 'super', 'import', 'export', 'from', 'as',
    'default', 'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of',
    'true', 'false', 'null', 'undefined', 'void', 'delete', 'static', 'get', 'set',
    'interface', 'type', 'enum', 'implements', 'private', 'public', 'protected',
    // Python
    'def', 'class', 'import', 'from', 'as', 'if', 'elif', 'else', 'for', 'while',
    'try', 'except', 'finally', 'raise', 'with', 'lambda', 'return', 'yield',
    'True', 'False', 'None', 'and', 'or', 'not', 'is', 'in', 'pass', 'global',
    'nonlocal', 'assert', 'break', 'continue', 'self', 'async', 'await',
    // Go
    'func', 'package', 'import', 'type', 'struct', 'interface', 'map', 'chan',
    'go', 'defer', 'select', 'range', 'make', 'append', 'len', 'cap', 'nil',
    // Rust
    'fn', 'let', 'mut', 'pub', 'mod', 'use', 'struct', 'enum', 'impl', 'trait',
    'match', 'loop', 'move', 'ref', 'self', 'Self', 'where', 'unsafe', 'async',
    // Common
    'print', 'println', 'printf', 'console', 'log', 'error', 'warn',
]);
/**
 * Truncate output for brief display
 */
const truncateOutput = (text, maxLen) => {
    const firstLine = text.split('\n')[0];
    if (firstLine.length > maxLen) {
        return firstLine.substring(0, maxLen) + '...';
    }
    return firstLine;
};
/**
 * Format diff output with colors
 */
const formatDiffOutput = (output) => {
    const lines = output.split('\n');
    return lines.map(line => {
        // File headers
        if (line.startsWith('diff --git')) {
            return chalk_1.default.bold.white(line);
        }
        if (line.startsWith('index ')) {
            return chalk_1.default.gray(line);
        }
        if (line.startsWith('---')) {
            return chalk_1.default.red.bold(line);
        }
        if (line.startsWith('+++')) {
            return chalk_1.default.green.bold(line);
        }
        // Hunk headers
        if (line.startsWith('@@')) {
            return chalk_1.default.cyan(line);
        }
        // Added lines
        if (line.startsWith('+')) {
            return chalk_1.default.green(line);
        }
        // Removed lines
        if (line.startsWith('-')) {
            return chalk_1.default.red(line);
        }
        // Context lines
        return chalk_1.default.gray(line);
    }).join('\n');
};
/**
 * Format git log output with colors
 */
const formatGitLogOutput = (output) => {
    const lines = output.split('\n');
    return lines.map(line => {
        // Commit hash
        if (line.match(/^[a-f0-9]{7,40}\s/)) {
            const parts = line.split(' ');
            const hash = parts[0];
            const rest = parts.slice(1).join(' ');
            return chalk_1.default.yellow(hash) + ' ' + rest;
        }
        // Date lines
        if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
            return chalk_1.default.blue(line);
        }
        // Author
        if (line.toLowerCase().includes('author:')) {
            return chalk_1.default.cyan(line);
        }
        // Commit message (indented)
        if (line.startsWith('  ')) {
            return chalk_1.default.white(line);
        }
        return line;
    }).join('\n');
};
/**
 * Format git status output with colors
 */
const formatGitStatusOutput = (output) => {
    const lines = output.split('\n');
    return lines.map(line => {
        // Branch info
        if (line.startsWith('On branch') || line.startsWith('HEAD detached')) {
            return chalk_1.default.cyan.bold(line);
        }
        // Modified files
        if (line.includes('modified:')) {
            return chalk_1.default.yellow(line);
        }
        // New files
        if (line.includes('new file:')) {
            return chalk_1.default.green(line);
        }
        // Deleted files
        if (line.includes('deleted:')) {
            return chalk_1.default.red(line);
        }
        // Untracked files header
        if (line.includes('Untracked files:')) {
            return chalk_1.default.magenta.bold(line);
        }
        // Staged changes header
        if (line.includes('Changes to be committed:')) {
            return chalk_1.default.green.bold(line);
        }
        // Unstaged changes header
        if (line.includes('Changes not staged')) {
            return chalk_1.default.yellow.bold(line);
        }
        // File status indicators (M, A, D, ??)
        if (line.match(/^\s*[MADRCU?]{1,2}\s+/)) {
            const status = line.match(/^\s*([MADRCU?]{1,2})\s+(.*)$/);
            if (status) {
                const indicator = status[1];
                const filename = status[2];
                let color = chalk_1.default.white;
                if (indicator.includes('M'))
                    color = chalk_1.default.yellow;
                if (indicator.includes('A'))
                    color = chalk_1.default.green;
                if (indicator.includes('D'))
                    color = chalk_1.default.red;
                if (indicator.includes('?'))
                    color = chalk_1.default.gray;
                return color(`  ${indicator} ${filename}`);
            }
        }
        return chalk_1.default.gray(line);
    }).join('\n');
};
/**
 * Apply syntax highlighting to a line of code
 */
const highlightCodeLine = (line) => {
    // Handle comments
    const commentMatch = line.match(/^(\s*)(\/\/.*|#.*|\/\*.*\*\/|<!--.*-->)$/);
    if (commentMatch) {
        return commentMatch[1] + syntaxColors.comment(commentMatch[2]);
    }
    let result = line;
    // Highlight strings (single, double, template)
    result = result.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, (match) => syntaxColors.string(match));
    // Highlight numbers
    result = result.replace(/\b(\d+\.?\d*)\b/g, (match) => syntaxColors.number(match));
    // Highlight keywords
    const words = result.split(/(\s+|[^\w])/);
    result = words
        .map((word) => {
        if (keywords.has(word)) {
            return syntaxColors.keyword(word);
        }
        return word;
    })
        .join("");
    // Highlight function calls
    result = result.replace(/\b([a-zA-Z_]\w*)\s*\(/g, (match, name) => syntaxColors.function(name) + "(");
    return result;
};
/**
 * Format file content with line numbers and syntax highlighting
 */
const formatFileContent = (content, filename) => {
    const lines = content.split('\n');
    const lineNumWidth = String(lines.length).length;
    return lines.map((line, idx) => {
        const lineNum = String(idx + 1).padStart(lineNumWidth, ' ');
        const highlighted = highlightCodeLine(line);
        return chalk_1.default.gray(`${lineNum} │ `) + highlighted;
    }).join('\n');
};
/**
 * Format bash command output
 */
const formatBashOutput = (output) => {
    // Check if it looks like a diff
    if (output.includes('diff --git') || output.includes('@@') && (output.includes('+') || output.includes('-'))) {
        return formatDiffOutput(output);
    }
    // Check if it looks like git log
    if (output.match(/^[a-f0-9]{7,40}\s+\d{4}-\d{2}-\d{2}/m)) {
        return formatGitLogOutput(output);
    }
    // Generic output with some highlighting
    const lines = output.split('\n');
    return lines.map(line => {
        // Error messages
        if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
            return chalk_1.default.red(line);
        }
        // Warning messages
        if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn')) {
            return chalk_1.default.yellow(line);
        }
        // Success messages
        if (line.toLowerCase().includes('success') || line.toLowerCase().includes('done') || line.toLowerCase().includes('passed')) {
            return chalk_1.default.green(line);
        }
        // Paths
        if (line.match(/^[./~]/)) {
            return chalk_1.default.cyan(line);
        }
        return line;
    }).join('\n');
};
/**
 * Format tool output based on tool type
 */
const formatToolOutput = (toolName, output) => {
    if (!output || output.trim() === '') {
        return chalk_1.default.gray('  (no output)');
    }
    const separator = chalk_1.default.gray('─'.repeat(60));
    let formatted;
    switch (toolName.toLowerCase()) {
        case 'git_diff':
        case 'gitdiff':
            formatted = formatDiffOutput(output);
            break;
        case 'git_log':
        case 'gitlog':
            formatted = formatGitLogOutput(output);
            break;
        case 'git_status':
        case 'gitstatus':
            formatted = formatGitStatusOutput(output);
            break;
        case 'read_file':
        case 'readfile':
            formatted = formatFileContent(output);
            break;
        case 'bash':
        case 'shell':
            formatted = formatBashOutput(output);
            break;
        case 'glob':
        case 'grep':
            // File lists - highlight paths
            formatted = output.split('\n').map(line => {
                if (line.includes(':')) {
                    const [path, ...rest] = line.split(':');
                    return chalk_1.default.cyan(path) + ':' + chalk_1.default.white(rest.join(':'));
                }
                return chalk_1.default.cyan(line);
            }).join('\n');
            break;
        default:
            formatted = output;
    }
    return `\n${chalk_1.default.gray('Output:')}\n${formatted}`;
};
exports.log = {
    info: (msg) => console.log(chalk_1.default.blue("ℹ"), msg),
    success: (msg) => console.log(chalk_1.default.green("✔"), msg),
    warning: (msg) => console.log(chalk_1.default.yellow("⚠"), msg),
    error: (msg) => console.log(chalk_1.default.red("✖"), msg),
    code: (msg) => console.log(chalk_1.default.gray(msg)),
    // Tool feedback methods
    tool: (name, action) => {
        console.log(chalk_1.default.cyan("🔧"), `Tool: ${chalk_1.default.bold(name)} - ${action}`);
    },
    toolResult: (success, message) => {
        if (success) {
            console.log(chalk_1.default.green("  ✓"), chalk_1.default.gray(truncateOutput(message, 100)));
        }
        else {
            console.log(chalk_1.default.red("  ✗"), chalk_1.default.gray(message));
        }
    },
    // Display formatted tool output
    toolOutput: (toolName, output) => {
        const formatted = formatToolOutput(toolName, output);
        console.log(formatted);
    },
};
const banner = (modelName, toolCount) => {
    console.log(chalk_1.default.bold.cyan(`
   ____             __      ________    ____
   / __ \\_________ _/ /_    / ____/ /   /  _/
  / /_/ / ___/ __ \`/ __ \\  / /   / /    / /
 / ____/ /  / /_/ / /_/ / / /___/ /____/ /
/_/   /_/   \\__,_/_.___/  \\____/_____/___/
`));
    if (modelName) {
        console.log(chalk_1.default.gray(`  Active Model: ${chalk_1.default.cyan(modelName)}`));
    }
    if (toolCount !== undefined) {
        console.log(chalk_1.default.gray(`  Available Tools: ${chalk_1.default.cyan(toolCount.toString())}`));
    }
    console.log("");
};
exports.banner = banner;
/**
 * Display a diff between two strings
 */
const showDiff = (before, after, filename) => {
    if (filename) {
        console.log(chalk_1.default.bold(`\nDiff for ${filename}:`));
    }
    const diff = (0, diff_1.diffLines)(before, after);
    diff.forEach((part) => {
        const color = part.added
            ? chalk_1.default.green
            : part.removed
                ? chalk_1.default.red
                : chalk_1.default.gray;
        const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
        const lines = part.value.split("\n");
        lines.forEach((line) => {
            if (line) {
                console.log(color(prefix + line));
            }
        });
    });
    console.log("");
};
exports.showDiff = showDiff;
/**
 * Display todo list
 */
const showTodoList = (todos) => {
    if (todos.length === 0) {
        console.log(chalk_1.default.gray("  No todos"));
        return;
    }
    console.log(chalk_1.default.bold("\n📋 Todo List:"));
    todos.forEach((todo, index) => {
        const status = todo.status === "completed"
            ? chalk_1.default.green("✓")
            : todo.status === "in_progress"
                ? chalk_1.default.yellow("⋯")
                : chalk_1.default.gray("○");
        const text = todo.status === "in_progress" ? todo.activeForm : todo.content;
        const textColor = todo.status === "completed"
            ? chalk_1.default.gray
            : todo.status === "in_progress"
                ? chalk_1.default.cyan
                : chalk_1.default.white;
        console.log(`  ${status} ${textColor(text)}`);
    });
    console.log("");
};
exports.showTodoList = showTodoList;
/**
 * Show tool execution progress
 */
const showToolProgress = (toolName, status) => {
    const icon = status === "started" ? "⏳" : status === "completed" ? "✓" : "✗";
    const color = status === "started"
        ? chalk_1.default.yellow
        : status === "completed"
            ? chalk_1.default.green
            : chalk_1.default.red;
    console.log(color(`${icon} ${toolName} ${status}`));
};
exports.showToolProgress = showToolProgress;
/**
 * Format a code block with syntax highlighting and borders
 */
const formatCodeBlock = (code, language) => {
    const lines = code.split("\n");
    const maxLineLen = Math.max(...lines.map((l) => l.length), 40);
    const boxWidth = Math.min(maxLineLen + 4, 80);
    const langLabel = language ? chalk_1.default.cyan.bold(` ${language} `) : "";
    const topBorder = chalk_1.default.gray("╭") + langLabel + chalk_1.default.gray("─".repeat(Math.max(0, boxWidth - language.length - 3))) + chalk_1.default.gray("╮");
    const bottomBorder = chalk_1.default.gray("╰" + "─".repeat(boxWidth - 1) + "╯");
    const formattedLines = lines.map((line) => {
        const highlighted = highlightCodeLine(line);
        return chalk_1.default.gray("│ ") + highlighted;
    });
    return [
        "",
        topBorder,
        ...formattedLines,
        bottomBorder,
        "",
    ].join("\n");
};
/**
 * Format markdown text with colors for terminal display
 */
const formatMarkdown = (text) => {
    let result = text;
    // Extract and format code blocks first (to avoid processing their content)
    const codeBlocks = [];
    let blockIndex = 0;
    result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const placeholder = `__CODE_BLOCK_${blockIndex}__`;
        codeBlocks.push({
            placeholder,
            formatted: formatCodeBlock(code.trimEnd(), lang || ""),
        });
        blockIndex++;
        return placeholder;
    });
    // Format inline code
    result = result.replace(/`([^`]+)`/g, (_, code) => {
        return chalk_1.default.bgGray.white(` ${code} `);
    });
    // Format headers
    result = result.replace(/^### (.+)$/gm, (_, text) => {
        return chalk_1.default.cyan.bold(`   ${text}`);
    });
    result = result.replace(/^## (.+)$/gm, (_, text) => {
        return chalk_1.default.cyan.bold(`  ${text}`);
    });
    result = result.replace(/^# (.+)$/gm, (_, text) => {
        return chalk_1.default.cyan.bold.underline(text);
    });
    // Format bold text
    result = result.replace(/\*\*([^*]+)\*\*/g, (_, text) => {
        return chalk_1.default.bold(text);
    });
    // Format italic text
    result = result.replace(/\*([^*]+)\*/g, (_, text) => {
        return chalk_1.default.italic(text);
    });
    // Format bullet points
    result = result.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, text) => {
        return indent + chalk_1.default.yellow("•") + " " + text;
    });
    // Format numbered lists
    result = result.replace(/^(\s*)(\d+)\. (.+)$/gm, (_, indent, num, text) => {
        return indent + chalk_1.default.yellow(num + ".") + " " + text;
    });
    // Format blockquotes
    result = result.replace(/^> (.+)$/gm, (_, text) => {
        return chalk_1.default.gray("│ ") + chalk_1.default.italic.gray(text);
    });
    // Format horizontal rules
    result = result.replace(/^---+$/gm, () => {
        return chalk_1.default.gray("─".repeat(50));
    });
    // Restore code blocks
    for (const block of codeBlocks) {
        result = result.replace(block.placeholder, block.formatted);
    }
    return result;
};
exports.formatMarkdown = formatMarkdown;
/**
 * Stream formatter for real-time markdown rendering
 * Handles partial chunks and code block detection
 */
class StreamFormatter {
    constructor() {
        this.buffer = "";
        this.inCodeBlock = false;
        this.codeBlockLang = "";
        this.codeBlockContent = "";
    }
    /**
     * Process a chunk of streaming text and return formatted output
     */
    processChunk(chunk) {
        this.buffer += chunk;
        let output = "";
        // Process complete lines
        while (this.buffer.includes("\n")) {
            const newlineIndex = this.buffer.indexOf("\n");
            const line = this.buffer.slice(0, newlineIndex);
            this.buffer = this.buffer.slice(newlineIndex + 1);
            output += this.processLine(line) + "\n";
        }
        return output;
    }
    /**
     * Flush remaining buffer content
     */
    flush() {
        if (this.buffer.length > 0) {
            const remaining = this.processLine(this.buffer);
            this.buffer = "";
            return remaining;
        }
        return "";
    }
    processLine(line) {
        // Check for code block start
        if (line.startsWith("```") && !this.inCodeBlock) {
            this.inCodeBlock = true;
            this.codeBlockLang = line.slice(3).trim();
            this.codeBlockContent = "";
            return ""; // Don't output yet
        }
        // Check for code block end
        if (line === "```" && this.inCodeBlock) {
            this.inCodeBlock = false;
            const formatted = formatCodeBlock(this.codeBlockContent.trimEnd(), this.codeBlockLang);
            this.codeBlockContent = "";
            this.codeBlockLang = "";
            return formatted;
        }
        // Inside code block - accumulate
        if (this.inCodeBlock) {
            this.codeBlockContent += line + "\n";
            return ""; // Don't output yet
        }
        // Regular line - format it
        return this.formatLine(line);
    }
    formatLine(line) {
        // Format inline code
        let result = line.replace(/`([^`]+)`/g, (_, code) => {
            return chalk_1.default.bgGray.white(` ${code} `);
        });
        // Format headers
        if (result.startsWith("### ")) {
            return chalk_1.default.cyan.bold("   " + result.slice(4));
        }
        if (result.startsWith("## ")) {
            return chalk_1.default.cyan.bold("  " + result.slice(3));
        }
        if (result.startsWith("# ")) {
            return chalk_1.default.cyan.bold.underline(result.slice(2));
        }
        // Format bold
        result = result.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk_1.default.bold(text));
        // Format italic
        result = result.replace(/\*([^*]+)\*/g, (_, text) => chalk_1.default.italic(text));
        // Format bullets
        if (/^\s*[-*] /.test(result)) {
            result = result.replace(/^(\s*)[-*] /, (_, indent) => indent + chalk_1.default.yellow("•") + " ");
        }
        // Format numbered lists
        result = result.replace(/^(\s*)(\d+)\. /, (_, indent, num) => indent + chalk_1.default.yellow(num + ".") + " ");
        // Format blockquotes
        if (result.startsWith("> ")) {
            return chalk_1.default.gray("│ ") + chalk_1.default.italic.gray(result.slice(2));
        }
        // Format horizontal rules
        if (/^---+$/.test(result)) {
            return chalk_1.default.gray("─".repeat(50));
        }
        return result;
    }
}
exports.StreamFormatter = StreamFormatter;
