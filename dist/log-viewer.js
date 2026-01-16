#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const LOG_DIR = path_1.default.join(os_1.default.homedir(), '.config', 'groq-cli-tool', 'logs');
// ═══════════════════════════════════════════════════════════════════════════════
// STYLING
// ═══════════════════════════════════════════════════════════════════════════════
const ICONS = {
    SESSION_START: '🚀',
    PROMPT_RECEIVED: '💬',
    API_REQUEST: '📡',
    API_RESPONSE: '📥',
    API_ERROR: '💥',
    AI_RESPONSE: '🤖',
    AI_TOOL_DECISION: '🧠',
    TOOL_START: '⚙️ ',
    TOOL_SUCCESS: '✅',
    TOOL_ERROR: '❌',
    TOOL_CANCELLED: '🚫',
    MODEL_INIT: '🔌',
    MODEL_SWITCH: '🔄',
    PROMPT_COMPLETE: '✨',
    PROMPT_FAILED: '💔',
    STREAM_CHUNK: '📦',
    ITERATION: '🔁',
    CONTEXT_ATTACHED: '📎',
    DEBUG: '🔍',
    WARNING: '⚠️ ',
    ERROR: '🔥',
};
const COLORS = {
    info: chalk_1.default.blue,
    success: chalk_1.default.green,
    error: chalk_1.default.red,
    warn: chalk_1.default.yellow,
    debug: chalk_1.default.gray,
    api: chalk_1.default.magenta,
    ai: chalk_1.default.cyan,
};
const BOX = {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    cross: '┼',
};
// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return chalk_1.default.dim(`${time}.${ms}`);
}
function formatDuration(ms) {
    if (ms < 1000)
        return chalk_1.default.dim(`${ms}ms`);
    return chalk_1.default.dim(`${(ms / 1000).toFixed(2)}s`);
}
function formatEntry(entry, verbose) {
    const lines = [];
    const icon = ICONS[entry.event] || '•';
    const color = COLORS[entry.level] || chalk_1.default.white;
    const time = formatTime(entry.timestamp);
    const duration = entry.duration ? ` ${formatDuration(entry.duration)}` : '';
    // Main line
    const mainLine = `${time} ${icon} ${color(entry.message)}${duration}`;
    lines.push(mainLine);
    // Add details for important events
    if (verbose && entry.data) {
        const indent = '           ';
        switch (entry.event) {
            case 'PROMPT_RECEIVED':
                if (entry.data.prompt && entry.data.prompt.length > 100) {
                    lines.push(chalk_1.default.dim(`${indent}Full prompt: "${entry.data.prompt.substring(0, 300)}..."`));
                }
                break;
            case 'AI_TOOL_DECISION':
                if (entry.data.toolCalls) {
                    entry.data.toolCalls.forEach((tc) => {
                        const argsStr = JSON.stringify(tc.args || {});
                        lines.push(chalk_1.default.dim(`${indent}→ ${chalk_1.default.cyan(tc.name)}(${argsStr.substring(0, 80)}${argsStr.length > 80 ? '...' : ''})`));
                    });
                }
                break;
            case 'TOOL_START':
                if (entry.data.args && Object.keys(entry.data.args).length > 0) {
                    const argsStr = JSON.stringify(entry.data.args);
                    lines.push(chalk_1.default.dim(`${indent}Args: ${argsStr.substring(0, 100)}${argsStr.length > 100 ? '...' : ''}`));
                }
                break;
            case 'TOOL_SUCCESS':
                if (entry.data.outputPreview) {
                    const preview = entry.data.outputPreview.replace(/\n/g, ' ').substring(0, 80);
                    lines.push(chalk_1.default.dim(`${indent}Output: "${preview}${entry.data.outputLength > 80 ? '...' : ''}"`));
                }
                break;
            case 'TOOL_ERROR':
                if (entry.data.error || entry.data.errorMessage) {
                    lines.push(chalk_1.default.red(`${indent}Error: ${entry.data.errorMessage || entry.data.error}`));
                }
                if (entry.data.args) {
                    const argsStr = JSON.stringify(entry.data.args);
                    lines.push(chalk_1.default.dim(`${indent}Args: ${argsStr.substring(0, 150)}${argsStr.length > 150 ? '...' : ''}`));
                }
                break;
            case 'API_ERROR':
            case 'PROMPT_FAILED':
                if (entry.data.error) {
                    lines.push(chalk_1.default.red(`${indent}Error: ${entry.data.error}`));
                }
                if (entry.data.stack) {
                    const stackLines = entry.data.stack.split('\n').slice(0, 3);
                    stackLines.forEach((line) => {
                        lines.push(chalk_1.default.dim(`${indent}${line.trim()}`));
                    });
                }
                break;
            case 'API_REQUEST':
                lines.push(chalk_1.default.dim(`${indent}Model: ${entry.data.model}, Messages: ${entry.data.messageCount}, Tools: ${entry.data.toolCount}`));
                break;
            case 'API_RESPONSE':
                lines.push(chalk_1.default.dim(`${indent}Content: ${entry.data.hasContent}, Tool calls: ${entry.data.toolCallCount}`));
                break;
            case 'AI_RESPONSE':
                if (entry.data.content && entry.data.length > 150) {
                    lines.push(chalk_1.default.dim(`${indent}(${entry.data.length} chars total)`));
                }
                break;
        }
    }
    return lines;
}
// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════
function displayBanner() {
    console.clear();
    console.log('');
    console.log(chalk_1.default.cyan.bold('  ╭─────────────────────────────────────────────────────────────╮'));
    console.log(chalk_1.default.cyan.bold('  │') + chalk_1.default.white.bold('           GROQ CLI - Real-time Logger                     ') + chalk_1.default.cyan.bold('│'));
    console.log(chalk_1.default.cyan.bold('  │') + chalk_1.default.dim('           Watching all CLI events live                     ') + chalk_1.default.cyan.bold('│'));
    console.log(chalk_1.default.cyan.bold('  ╰─────────────────────────────────────────────────────────────╯'));
    console.log('');
}
function displayWaiting(logFile) {
    const fileName = path_1.default.basename(logFile);
    console.log(chalk_1.default.dim(`  Watching: ${fileName}`));
    console.log(chalk_1.default.dim('  Waiting for events... (Press Ctrl+C to exit)'));
    console.log('');
    console.log(chalk_1.default.dim('  ' + '─'.repeat(60)));
    console.log('');
}
function displayStats(stats) {
    console.log('');
    console.log(chalk_1.default.cyan.bold('  ╭─────────────────────────────────────────────────────────────╮'));
    console.log(chalk_1.default.cyan.bold('  │') + chalk_1.default.white.bold('                    SESSION SUMMARY                         ') + chalk_1.default.cyan.bold('│'));
    console.log(chalk_1.default.cyan.bold('  ├─────────────────────────────────────────────────────────────┤'));
    console.log(chalk_1.default.cyan.bold('  │') + `  💬 Prompts:        ${String(stats.prompts).padStart(5)}                               ` + chalk_1.default.cyan.bold('│'));
    console.log(chalk_1.default.cyan.bold('  │') + `  📡 API Requests:   ${String(stats.apiRequests).padStart(5)}                               ` + chalk_1.default.cyan.bold('│'));
    console.log(chalk_1.default.cyan.bold('  │') + `  🤖 AI Responses:   ${String(stats.aiResponses).padStart(5)}                               ` + chalk_1.default.cyan.bold('│'));
    console.log(chalk_1.default.cyan.bold('  │') + `  ⚙️  Tool Calls:     ${String(stats.toolCalls).padStart(5)}                               ` + chalk_1.default.cyan.bold('│'));
    console.log(chalk_1.default.cyan.bold('  │') + `  ${stats.errors > 0 ? chalk_1.default.red('❌') : '✅'} Errors:         ${String(stats.errors).padStart(5)}                               ` + chalk_1.default.cyan.bold('│'));
    console.log(chalk_1.default.cyan.bold('  ╰─────────────────────────────────────────────────────────────╯'));
    console.log('');
}
function displayHelp() {
    console.log('');
    console.log(chalk_1.default.cyan.bold('  GROQ CLI - Real-time Logger'));
    console.log('');
    console.log(chalk_1.default.white('  Usage:'));
    console.log(chalk_1.default.dim('    npm run log              ') + 'Watch latest session (real-time)');
    console.log(chalk_1.default.dim('    npm run log -- -v        ') + 'Verbose mode (show details)');
    console.log(chalk_1.default.dim('    npm run log:list         ') + 'List all sessions');
    console.log(chalk_1.default.dim('    npm run log:help         ') + 'Show this help');
    console.log('');
    console.log(chalk_1.default.white('  Legend:'));
    console.log(`    ${ICONS.PROMPT_RECEIVED} User prompt     ${ICONS.API_REQUEST} API request    ${ICONS.AI_RESPONSE} AI response`);
    console.log(`    ${ICONS.AI_TOOL_DECISION} AI decision     ${ICONS.TOOL_START} Tool start     ${ICONS.TOOL_SUCCESS} Tool success`);
    console.log(`    ${ICONS.TOOL_ERROR} Tool error      ${ICONS.MODEL_SWITCH} Model switch   ${ICONS.PROMPT_COMPLETE} Complete`);
    console.log('');
    console.log(chalk_1.default.white('  Run in two terminals:'));
    console.log(chalk_1.default.dim('    Terminal 1: ') + chalk_1.default.green('npm run dev'));
    console.log(chalk_1.default.dim('    Terminal 2: ') + chalk_1.default.green('npm run log'));
    console.log('');
}
function displaySessions() {
    if (!fs_1.default.existsSync(LOG_DIR)) {
        console.log(chalk_1.default.yellow('\n  No log directory found. Start the CLI first.\n'));
        return;
    }
    const files = fs_1.default.readdirSync(LOG_DIR)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
        name: f,
        path: path_1.default.join(LOG_DIR, f),
        stat: fs_1.default.statSync(path_1.default.join(LOG_DIR, f))
    }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
    console.log('');
    console.log(chalk_1.default.cyan.bold('  Recent Sessions'));
    console.log(chalk_1.default.dim('  ' + '─'.repeat(50)));
    console.log('');
    if (files.length === 0) {
        console.log(chalk_1.default.yellow('  No sessions found. Start the CLI with `npm run dev`'));
    }
    else {
        files.slice(0, 10).forEach((file, index) => {
            const name = file.name.replace('session-', '').replace('.jsonl', '');
            const date = file.stat.mtime.toLocaleString();
            const size = (file.stat.size / 1024).toFixed(1);
            const latest = index === 0 ? chalk_1.default.green(' (latest)') : '';
            console.log(`  ${chalk_1.default.cyan((index + 1) + '.')} ${name}${latest}`);
            console.log(chalk_1.default.dim(`     ${date} - ${size} KB`));
        });
    }
    console.log('');
}
// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WATCHER
// ═══════════════════════════════════════════════════════════════════════════════
async function watchLogs(verbose) {
    // Find latest log file
    if (!fs_1.default.existsSync(LOG_DIR)) {
        fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
    }
    const files = fs_1.default.readdirSync(LOG_DIR)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
        name: f,
        path: path_1.default.join(LOG_DIR, f),
        mtime: fs_1.default.statSync(path_1.default.join(LOG_DIR, f)).mtime.getTime()
    }))
        .sort((a, b) => b.mtime - a.mtime);
    let logFile = files.length > 0 ? files[0].path : null;
    let lastSize = logFile && fs_1.default.existsSync(logFile) ? fs_1.default.statSync(logFile).size : 0;
    const stats = {
        prompts: 0,
        toolCalls: 0,
        apiRequests: 0,
        errors: 0,
        aiResponses: 0
    };
    displayBanner();
    if (logFile) {
        displayWaiting(logFile);
        // Read existing entries
        const content = fs_1.default.readFileSync(logFile, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l.trim());
        // Show last 15 entries
        const recentLines = lines.slice(-15);
        recentLines.forEach(line => {
            try {
                const entry = JSON.parse(line);
                updateStats(stats, entry);
                formatEntry(entry, verbose).forEach(l => console.log(l));
            }
            catch { }
        });
        if (lines.length > 15) {
            console.log(chalk_1.default.dim(`\n  ... ${lines.length - 15} earlier entries hidden\n`));
        }
    }
    else {
        console.log(chalk_1.default.dim('  Waiting for CLI to start...\n'));
    }
    // Watch for new entries
    const interval = setInterval(() => {
        // Check for new log files
        const currentFiles = fs_1.default.readdirSync(LOG_DIR)
            .filter(f => f.endsWith('.jsonl'))
            .map(f => ({
            name: f,
            path: path_1.default.join(LOG_DIR, f),
            mtime: fs_1.default.statSync(path_1.default.join(LOG_DIR, f)).mtime.getTime()
        }))
            .sort((a, b) => b.mtime - a.mtime);
        if (currentFiles.length > 0) {
            const latestFile = currentFiles[0].path;
            // If new session started
            if (latestFile !== logFile) {
                logFile = latestFile;
                lastSize = 0;
                console.log('');
                console.log(chalk_1.default.cyan.bold('  ═══ New Session Started ═══'));
                console.log('');
            }
            // Read new content
            if (logFile && fs_1.default.existsSync(logFile)) {
                const stat = fs_1.default.statSync(logFile);
                if (stat.size > lastSize) {
                    const content = fs_1.default.readFileSync(logFile, 'utf-8');
                    const allLines = content.split('\n').filter(l => l.trim());
                    // Calculate how many new lines
                    const oldContent = content.substring(0, lastSize);
                    const oldLineCount = oldContent.split('\n').filter(l => l.trim()).length;
                    const newLines = allLines.slice(oldLineCount);
                    newLines.forEach(line => {
                        try {
                            const entry = JSON.parse(line);
                            updateStats(stats, entry);
                            formatEntry(entry, verbose).forEach(l => console.log(l));
                        }
                        catch { }
                    });
                    lastSize = stat.size;
                }
            }
        }
    }, 200);
    // Handle exit
    process.on('SIGINT', () => {
        clearInterval(interval);
        displayStats(stats);
        console.log(chalk_1.default.dim('  Logger stopped.\n'));
        process.exit(0);
    });
    // Keep alive
    await new Promise(() => { });
}
function updateStats(stats, entry) {
    switch (entry.event) {
        case 'PROMPT_RECEIVED':
            stats.prompts++;
            break;
        case 'API_REQUEST':
            stats.apiRequests++;
            break;
        case 'AI_RESPONSE':
            stats.aiResponses++;
            break;
        case 'TOOL_START':
            stats.toolCalls++;
            break;
        case 'TOOL_ERROR':
        case 'API_ERROR':
        case 'PROMPT_FAILED':
        case 'ERROR':
            stats.errors++;
            break;
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('help') || args.includes('-h') || args.includes('--help')) {
        displayHelp();
        return;
    }
    if (args.includes('list') || args.includes('-l')) {
        displaySessions();
        return;
    }
    const verbose = args.includes('-v') || args.includes('--verbose');
    await watchLogs(verbose);
}
main().catch(console.error);
