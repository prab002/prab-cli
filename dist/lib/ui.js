"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showToolProgress = exports.showTodoList = exports.showDiff = exports.banner = exports.log = void 0;
const chalk_1 = __importDefault(require("chalk"));
const diff_1 = require("diff");
exports.log = {
    info: (msg) => console.log(chalk_1.default.blue('ℹ'), msg),
    success: (msg) => console.log(chalk_1.default.green('✔'), msg),
    warning: (msg) => console.log(chalk_1.default.yellow('⚠'), msg),
    error: (msg) => console.log(chalk_1.default.red('✖'), msg),
    code: (msg) => console.log(chalk_1.default.gray(msg)),
    // Tool feedback methods
    tool: (name, action) => {
        console.log(chalk_1.default.cyan('🔧'), `Tool: ${chalk_1.default.bold(name)} - ${action}`);
    },
    toolResult: (success, message) => {
        if (success) {
            console.log(chalk_1.default.green('  ✓'), chalk_1.default.gray(message));
        }
        else {
            console.log(chalk_1.default.red('  ✗'), chalk_1.default.gray(message));
        }
    }
};
const banner = (modelName, toolCount) => {
    console.log(chalk_1.default.bold.cyan(`
   ______                   _______    ____
  / ____/________  ____ _  / ____/ /   /  _/
 / / __/ ___/ __ \\/ __ \`/ / /   / /    / /
/ /_/ / /  / /_/ / /_/ / / /___/ /____/ /
\\____/_/   \\____/\\__, /  \\____/_____/___/
                /____/
`));
    if (modelName) {
        console.log(chalk_1.default.gray(`  Active Model: ${chalk_1.default.cyan(modelName)}`));
    }
    if (toolCount !== undefined) {
        console.log(chalk_1.default.gray(`  Available Tools: ${chalk_1.default.cyan(toolCount.toString())}`));
    }
    console.log('');
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
    diff.forEach(part => {
        const color = part.added ? chalk_1.default.green :
            part.removed ? chalk_1.default.red :
                chalk_1.default.gray;
        const prefix = part.added ? '+ ' :
            part.removed ? '- ' :
                '  ';
        const lines = part.value.split('\n');
        lines.forEach(line => {
            if (line) {
                console.log(color(prefix + line));
            }
        });
    });
    console.log('');
};
exports.showDiff = showDiff;
/**
 * Display todo list
 */
const showTodoList = (todos) => {
    if (todos.length === 0) {
        console.log(chalk_1.default.gray('  No todos'));
        return;
    }
    console.log(chalk_1.default.bold('\n📋 Todo List:'));
    todos.forEach((todo, index) => {
        const status = todo.status === 'completed' ? chalk_1.default.green('✓') :
            todo.status === 'in_progress' ? chalk_1.default.yellow('⋯') :
                chalk_1.default.gray('○');
        const text = todo.status === 'in_progress' ? todo.activeForm : todo.content;
        const textColor = todo.status === 'completed' ? chalk_1.default.gray :
            todo.status === 'in_progress' ? chalk_1.default.cyan :
                chalk_1.default.white;
        console.log(`  ${status} ${textColor(text)}`);
    });
    console.log('');
};
exports.showTodoList = showTodoList;
/**
 * Show tool execution progress
 */
const showToolProgress = (toolName, status) => {
    const icon = status === 'started' ? '⏳' :
        status === 'completed' ? '✓' :
            '✗';
    const color = status === 'started' ? chalk_1.default.yellow :
        status === 'completed' ? chalk_1.default.green :
            chalk_1.default.red;
    console.log(color(`${icon} ${toolName} ${status}`));
};
exports.showToolProgress = showToolProgress;
