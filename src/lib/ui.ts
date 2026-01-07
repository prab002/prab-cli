import chalk from 'chalk';
import { TodoItem } from '../types';
import { diffLines } from 'diff';

export const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✖'), msg),
  code: (msg: string) => console.log(chalk.gray(msg)),

  // Tool feedback methods
  tool: (name: string, action: string) => {
    console.log(chalk.cyan('🔧'), `Tool: ${chalk.bold(name)} - ${action}`);
  },

  toolResult: (success: boolean, message: string) => {
    if (success) {
      console.log(chalk.green('  ✓'), chalk.gray(message));
    } else {
      console.log(chalk.red('  ✗'), chalk.gray(message));
    }
  }
};

export const banner = (modelName?: string, toolCount?: number) => {
    console.log(chalk.bold.cyan(`
   ______                   _______    ____
  / ____/________  ____ _  / ____/ /   /  _/
 / / __/ ___/ __ \\/ __ \`/ / /   / /    / /
/ /_/ / /  / /_/ / /_/ / / /___/ /____/ /
\\____/_/   \\____/\\__, /  \\____/_____/___/
                /____/
`));

    if (modelName) {
        console.log(chalk.gray(`  Active Model: ${chalk.cyan(modelName)}`));
    }
    if (toolCount !== undefined) {
        console.log(chalk.gray(`  Available Tools: ${chalk.cyan(toolCount.toString())}`));
    }
    console.log('');
};

/**
 * Display a diff between two strings
 */
export const showDiff = (before: string, after: string, filename?: string) => {
    if (filename) {
        console.log(chalk.bold(`\nDiff for ${filename}:`));
    }

    const diff = diffLines(before, after);

    diff.forEach(part => {
        const color = part.added ? chalk.green :
                     part.removed ? chalk.red :
                     chalk.gray;

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

/**
 * Display todo list
 */
export const showTodoList = (todos: TodoItem[]) => {
    if (todos.length === 0) {
        console.log(chalk.gray('  No todos'));
        return;
    }

    console.log(chalk.bold('\n📋 Todo List:'));

    todos.forEach((todo, index) => {
        const status = todo.status === 'completed' ? chalk.green('✓') :
                      todo.status === 'in_progress' ? chalk.yellow('⋯') :
                      chalk.gray('○');

        const text = todo.status === 'in_progress' ? todo.activeForm : todo.content;
        const textColor = todo.status === 'completed' ? chalk.gray :
                         todo.status === 'in_progress' ? chalk.cyan :
                         chalk.white;

        console.log(`  ${status} ${textColor(text)}`);
    });
    console.log('');
};

/**
 * Show tool execution progress
 */
export const showToolProgress = (toolName: string, status: 'started' | 'completed' | 'failed') => {
    const icon = status === 'started' ? '⏳' :
                status === 'completed' ? '✓' :
                '✗';

    const color = status === 'started' ? chalk.yellow :
                 status === 'completed' ? chalk.green :
                 chalk.red;

    console.log(color(`${icon} ${toolName} ${status}`));
};
