#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const config_1 = require("./lib/config");
const groq_1 = require("./lib/groq");
const context_1 = require("./lib/context");
const ui_1 = require("./lib/ui");
const ora_1 = __importDefault(require("ora"));
const program = new commander_1.Command();
program
    .name('groq-cli')
    .description('A fast AI coding assistant powered by Groq')
    .version('1.0.0');
program
    .command('config [key]')
    .description('Set your Groq API Key')
    .action(async (key) => {
    if (key) {
        (0, config_1.setApiKey)(key.trim());
        ui_1.log.success('API Key saved successfully!');
        return;
    }
    const { inputKey } = await inquirer_1.default.prompt([
        {
            type: 'password',
            name: 'inputKey',
            message: 'Enter your Groq API Key:',
            mask: '*',
        },
    ]);
    (0, config_1.setApiKey)(inputKey.trim());
    ui_1.log.success('API Key saved successfully!');
});
program
    .command('reset')
    .description('Clear your stored API Key')
    .action(() => {
    (0, config_1.clearApiKey)();
    ui_1.log.success('API Key cleared!');
});
program
    .action(async () => {
    (0, ui_1.banner)();
    // Check API Key
    let apiKey = (0, config_1.getApiKey)();
    if (!apiKey) {
        ui_1.log.warning('No API Key found.');
        const { key } = await inquirer_1.default.prompt([
            {
                type: 'password',
                name: 'key',
                message: 'Please enter your Groq API Key to get started:',
                mask: '*',
            },
        ]);
        (0, config_1.setApiKey)(key.trim());
        apiKey = key.trim();
    }
    try {
        (0, groq_1.initGroq)();
    }
    catch (e) {
        ui_1.log.error('Failed to initialize Groq client.');
        process.exit(1);
    }
    // Context Gathering
    const spinner = (0, ora_1.default)('Checking context...').start();
    const isRepo = await (0, context_1.isGitRepo)();
    let contextMessage = '';
    if (isRepo) {
        spinner.text = 'Git repository detected. Gathering file structure...';
        const files = await (0, context_1.getFileTree)();
        // Limit context to file names for now to save tokens, read content only if asked?
        // For a simple CLI, let's just dump the file tree as context.
        contextMessage = `\n\nCurrent Working Directory Context:\nFile List:\n${files.join('\n')}`;
        spinner.succeed(`Context loaded (${files.length} files detected).`);
    }
    else {
        spinner.succeed('No Git repository detected. Running in standalone mode.');
    }
    const messages = [
        {
            role: 'system',
            content: `You are an expert coding assistant. You are running in a CLI tool.
        Capabilities:
        - You can write code in any language.
        - You should provide concise, correct, and well-formatted code.
        - You have access to the file structure of the current directory if it is a git repo.
        ${contextMessage}
        `
        }
    ];
    // Chat Loop
    while (true) {
        const { userInput } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'userInput',
                message: '>',
            },
        ]);
        // Handle Slash Commands
        if (userInput.trim() === '/') {
            const { action } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Slash Commands:',
                    choices: [
                        { name: 'Display Context', value: 'context' },
                        { name: 'Clear Chat History', value: 'clear' },
                        { name: 'Update API Key', value: 'config' },
                        { name: 'Exit', value: 'exit' },
                        { name: 'Cancel', value: 'cancel' }
                    ]
                }
            ]);
            if (action === 'context') {
                ui_1.log.info(contextMessage || 'No context loaded.');
                continue;
            }
            if (action === 'clear') {
                messages.length = 1; // Keep system prompt
                ui_1.log.success('Chat history cleared.');
                continue;
            }
            if (action === 'config') {
                const { key } = await inquirer_1.default.prompt([{ type: 'password', name: 'key', message: 'Enter new API Key:', mask: '*' }]);
                (0, config_1.setApiKey)(key.trim());
                (0, groq_1.initGroq)();
                ui_1.log.success('API Key updated.');
                continue;
            }
            if (action === 'exit')
                process.exit(0);
            if (action === 'cancel')
                continue;
        }
        if (userInput.startsWith('/')) {
            const cmd = userInput.trim().toLowerCase();
            if (cmd === '/exit' || cmd === '/quit')
                process.exit(0);
            if (cmd === '/clear') {
                messages.length = 1;
                ui_1.log.success('History cleared.');
                continue;
            }
            if (cmd === '/context') {
                ui_1.log.info(contextMessage || 'No context.');
                continue;
            }
            ui_1.log.warning(`Unknown command: ${cmd}`);
            continue;
        }
        messages.push({ role: 'user', content: userInput });
        try {
            const stream = await (0, groq_1.streamChat)(messages);
            let assistantResponse = '';
            process.stdout.write('\n'); // Newline before response
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                process.stdout.write(content);
                assistantResponse += content;
            }
            process.stdout.write('\n\n'); // Newline after response
            messages.push({ role: 'assistant', content: assistantResponse });
        }
        catch (error) {
            ui_1.log.error(`Error: ${error.message}`);
        }
    }
});
program.parse(process.argv);
