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
                        { name: 'Review Code', value: 'review' },
                        { name: 'Analyze Project', value: 'analyze' },
                        { name: 'Display Context', value: 'context' },
                        { name: 'Clear Chat History', value: 'clear' },
                        { name: 'Update API Key', value: 'config' },
                        { name: 'Exit', value: 'exit' },
                        { name: 'Cancel', value: 'cancel' }
                    ]
                }
            ]);
            if (action === 'review') {
                const { target } = await inquirer_1.default.prompt([{
                        type: 'input',
                        name: 'target',
                        message: 'Enter file path to review (or press enter for full context):'
                    }]);
                let contentToReview = '';
                let filePath = '';
                if (target.trim()) {
                    filePath = target.trim();
                    contentToReview = (0, context_1.getFileContent)(filePath);
                    if (!contentToReview) {
                        ui_1.log.error('File not found or empty.');
                        continue;
                    }
                }
                else {
                    contentToReview = contextMessage;
                }
                const spinner = (0, ora_1.default)('Reviewing code...').start();
                const reviewPrompt = `
             Please review the following code.
             File: ${filePath || 'Current Context'}
             Code:
             ${contentToReview}
             
             1. Analyze for bugs, improvements, and best practices.
             2. If you find improvements, provide the FULL corrected code for the file wrapped in <<<CODE>>> and <<<CODE>>> delimiters.
             Example:
             <<<CODE>>>
             const a = 1;
             <<<CODE>>>
             `;
                messages.push({ role: 'user', content: reviewPrompt });
                try {
                    const stream = await (0, groq_1.streamChat)(messages);
                    let assistantResponse = '';
                    process.stdout.write('\n');
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || '';
                        process.stdout.write(content);
                        assistantResponse += content;
                    }
                    process.stdout.write('\n\n');
                    messages.push({ role: 'assistant', content: assistantResponse });
                    spinner.stop();
                    // Check for code block to apply
                    const codeMatch = assistantResponse.match(/<<<CODE>>>([\s\S]*?)<<<CODE>>>/);
                    if (codeMatch && codeMatch[1] && filePath) {
                        const { apply } = await inquirer_1.default.prompt([{
                                type: 'confirm',
                                name: 'apply',
                                message: `AI suggested changes for ${filePath}. Apply them now?`,
                                default: false
                            }]);
                        if (apply) {
                            const { writeFile } = require('./lib/context');
                            writeFile(filePath, codeMatch[1].trim());
                            ui_1.log.success(`Successfully updated ${filePath}`);
                        }
                    }
                }
                catch (e) {
                    spinner.fail(`Review failed: ${e.message}`);
                    ui_1.log.error(e);
                }
                continue;
            }
            if (action === 'analyze') {
                const spinner = (0, ora_1.default)('Analyzing project structure...').start();
                try {
                    const files = await (0, context_1.getFileTree)();
                    const packageJson = (0, context_1.getFileContent)('package.json');
                    const readme = (0, context_1.getFileContent)('README.md');
                    const analysisPrompt = `
                Please analyze this project based on its file structure and key files.
                
                File Structure:
                ${files.slice(0, 100).join('\n')}${files.length > 100 ? '\n...(truncated)' : ''}
                
                package.json:
                ${packageJson}
                
                README.md:
                ${readme}
                
                Provide a summary of what this project does, its tech stack, and any observations.
                `;
                    spinner.succeed('Context gathered. Generating analysis...');
                    messages.push({ role: 'user', content: analysisPrompt });
                    const stream = await (0, groq_1.streamChat)(messages);
                    let assistantResponse = '';
                    process.stdout.write('\n');
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || '';
                        process.stdout.write(content);
                        assistantResponse += content;
                    }
                    process.stdout.write('\n\n');
                    messages.push({ role: 'assistant', content: assistantResponse });
                }
                catch (e) {
                    spinner.fail(`Analysis failed: ${e.message}`);
                    ui_1.log.error(e);
                }
                continue;
            }
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
