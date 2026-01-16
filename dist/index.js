#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const config_1 = require("./lib/config");
const context_1 = require("./lib/context");
const ui_1 = require("./lib/ui");
const config_2 = require("./lib/config");
const ora_1 = __importDefault(require("ora"));
// Import tool system
const base_1 = require("./lib/tools/base");
const executor_1 = require("./lib/tools/executor");
const file_tools_1 = require("./lib/tools/file-tools");
const shell_tools_1 = require("./lib/tools/shell-tools");
const git_tools_1 = require("./lib/tools/git-tools");
const todo_tool_1 = require("./lib/tools/todo-tool");
// Import model system
const groq_provider_1 = require("./lib/models/groq-provider");
const registry_1 = require("./lib/models/registry");
// Import chat handler and safety
const chat_handler_1 = require("./lib/chat-handler");
const safety_1 = require("./lib/safety");
const tracker_1 = require("./lib/tracker");
const program = new commander_1.Command();
program
    .name('groq-cli')
    .description('An AI coding assistant with autonomous tool capabilities')
    .version('2.0.0');
// Config command
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
// Reset command
program
    .command('reset')
    .description('Clear your stored API Key')
    .action(() => {
    (0, config_1.clearApiKey)();
    ui_1.log.success('API Key cleared!');
});
// Model management commands
program
    .command('model')
    .description('Manage AI models')
    .action(async () => {
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Model Management:',
            choices: [
                { name: 'List available models', value: 'list' },
                { name: 'Show current model', value: 'current' },
                { name: 'Switch model', value: 'switch' },
                { name: 'Cancel', value: 'cancel' }
            ]
        }
    ]);
    if (action === 'list') {
        console.log('\nAvailable Models:\n');
        console.log((0, registry_1.getModelList)());
    }
    else if (action === 'current') {
        const config = (0, config_1.getModelConfig)();
        ui_1.log.info(`Current model: ${config.modelId}`);
        ui_1.log.info(`Temperature: ${config.temperature}`);
    }
    else if (action === 'switch') {
        const { modelId } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'modelId',
                message: 'Enter model ID:'
            }
        ]);
        const validation = (0, registry_1.validateModelId)(modelId);
        if (validation.valid) {
            (0, config_1.setActiveModel)(modelId);
            ui_1.log.success(`Switched to model: ${modelId}`);
        }
        else {
            ui_1.log.error(validation.error || 'Invalid model');
            if (validation.suggested) {
                ui_1.log.info(`Did you mean: ${validation.suggested}?`);
            }
        }
    }
});
// Main interactive mode
program
    .action(async () => {
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
    // Initialize tool registry
    const toolRegistry = new base_1.ToolRegistry();
    toolRegistry.register(new file_tools_1.ReadFileTool());
    toolRegistry.register(new file_tools_1.WriteFileTool());
    toolRegistry.register(new file_tools_1.EditFileTool());
    toolRegistry.register(new file_tools_1.GlobTool());
    toolRegistry.register(new file_tools_1.GrepTool());
    toolRegistry.register(new shell_tools_1.BashTool());
    toolRegistry.register(new git_tools_1.GitStatusTool());
    toolRegistry.register(new git_tools_1.GitAddTool());
    toolRegistry.register(new git_tools_1.GitDiffTool());
    toolRegistry.register(new git_tools_1.GitLogTool());
    toolRegistry.register(new git_tools_1.GitCommitTool());
    toolRegistry.register(new git_tools_1.GitBranchTool());
    toolRegistry.register(new git_tools_1.GitPushTool());
    toolRegistry.register(new todo_tool_1.TodoTool());
    // Initialize safety checker and tool executor
    const safetyChecker = new safety_1.SafetyChecker();
    const toolExecutor = new executor_1.ToolExecutor(toolRegistry, safetyChecker);
    // Initialize model provider
    const modelConfig = (0, config_1.getModelConfig)();
    const modelProvider = new groq_provider_1.GroqProvider(modelConfig.modelId, modelConfig.temperature);
    try {
        modelProvider.initialize(apiKey, modelConfig.modelId);
        tracker_1.tracker.modelInit(modelConfig.modelId, 'groq', true);
        tracker_1.tracker.sessionStart(modelConfig.modelId, toolRegistry.count());
    }
    catch (e) {
        ui_1.log.error('Failed to initialize model.');
        tracker_1.tracker.modelInit(modelConfig.modelId, 'groq', false, e.message);
        process.exit(1);
    }
    // Display banner
    (0, ui_1.banner)(modelConfig.modelId, toolRegistry.count());
    // Context Gathering
    const spinner = (0, ora_1.default)('Checking context...').start();
    const isRepo = await (0, context_1.isGitRepo)();
    let contextMessage = '';
    if (isRepo) {
        spinner.text = 'Git repository detected. Gathering file structure...';
        const files = await (0, context_1.getFileTree)();
        contextMessage = `\n\nCurrent Working Directory Context:\nFile List:\n${files.join('\n')}`;
        spinner.succeed(`Context loaded (${files.length} files detected).`);
    }
    else {
        spinner.succeed('No Git repository detected. Running in standalone mode.');
    }
    // Initialize chat handler
    const chatHandler = new chat_handler_1.ChatHandler(toolRegistry, toolExecutor, modelProvider, contextMessage);
    ui_1.log.info('Type "/" for commands menu, or start chatting!');
    // Display any existing todos
    const session = (0, config_2.getSessionData)();
    if (session.todos && session.todos.length > 0) {
        (0, ui_1.showTodoList)(session.todos);
    }
    // Chat Loop
    while (true) {
        const { userInput } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'userInput',
                message: '>',
            },
        ]);
        // Handle Slash Commands Menu
        if (userInput.trim() === '/') {
            const { action } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Commands:',
                    choices: [
                        { name: 'List Tools', value: 'tools' },
                        { name: 'Show Todos', value: 'todos' },
                        { name: 'Clear Todos', value: 'clear_todos' },
                        { name: 'Display Context', value: 'context' },
                        { name: 'Clear Chat History', value: 'clear' },
                        { name: 'Switch Model', value: 'model' },
                        { name: 'Show Preferences', value: 'prefs' },
                        { name: 'Update API Key', value: 'config' },
                        { name: 'Exit', value: 'exit' },
                        { name: 'Cancel', value: 'cancel' }
                    ]
                }
            ]);
            if (action === 'tools') {
                console.log('\n📦 Available Tools:\n');
                console.log(toolRegistry.getToolDescriptions());
                console.log('');
                continue;
            }
            if (action === 'todos') {
                const session = (0, config_2.getSessionData)();
                (0, ui_1.showTodoList)(session.todos);
                continue;
            }
            if (action === 'clear_todos') {
                (0, config_1.clearSessionData)();
                ui_1.log.success('Todos cleared.');
                continue;
            }
            if (action === 'context') {
                ui_1.log.info(contextMessage || 'No context loaded.');
                continue;
            }
            if (action === 'clear') {
                chatHandler.clearHistory();
                ui_1.log.success('Chat history cleared.');
                continue;
            }
            if (action === 'model') {
                console.log('\nAvailable Models:\n');
                console.log((0, registry_1.getModelList)());
                console.log('');
                const { newModel } = await inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'newModel',
                        message: 'Enter model ID (or press enter to cancel):'
                    }
                ]);
                if (newModel.trim()) {
                    const oldModel = modelConfig.modelId;
                    const validation = (0, registry_1.validateModelId)(newModel.trim());
                    if (validation.valid) {
                        (0, config_1.setActiveModel)(newModel.trim());
                        modelProvider.setModel(newModel.trim());
                        ui_1.log.success(`Switched to model: ${newModel.trim()}`);
                        tracker_1.tracker.modelSwitch(oldModel, newModel.trim(), true);
                    }
                    else {
                        ui_1.log.error(validation.error || 'Invalid model');
                        tracker_1.tracker.modelSwitch(oldModel, newModel.trim(), false);
                        if (validation.suggested) {
                            ui_1.log.info(`Did you mean: ${validation.suggested}?`);
                        }
                    }
                }
                continue;
            }
            if (action === 'prefs') {
                const prefs = (0, config_1.getPreferences)();
                console.log('\n⚙️  Current Preferences:\n');
                console.log(`  Temperature: ${prefs.temperature}`);
                console.log(`  Auto-Confirm: ${prefs.autoConfirm}`);
                console.log(`  Safe Mode: ${prefs.safeMode}`);
                console.log('');
                continue;
            }
            if (action === 'config') {
                const { key } = await inquirer_1.default.prompt([{
                        type: 'password',
                        name: 'key',
                        message: 'Enter new API Key:',
                        mask: '*'
                    }]);
                (0, config_1.setApiKey)(key.trim());
                modelProvider.initialize(key.trim(), modelConfig.modelId);
                ui_1.log.success('API Key updated.');
                continue;
            }
            if (action === 'exit')
                process.exit(0);
            if (action === 'cancel')
                continue;
        }
        // Handle direct slash commands
        if (userInput.startsWith('/')) {
            const cmd = userInput.trim().toLowerCase();
            if (cmd === '/exit' || cmd === '/quit')
                process.exit(0);
            if (cmd === '/clear') {
                chatHandler.clearHistory();
                ui_1.log.success('History cleared.');
                continue;
            }
            if (cmd === '/context') {
                ui_1.log.info(contextMessage || 'No context.');
                continue;
            }
            if (cmd === '/tools') {
                console.log('\n📦 Available Tools:\n');
                console.log(toolRegistry.getToolDescriptions());
                console.log('');
                continue;
            }
            if (cmd === '/todos') {
                const session = (0, config_2.getSessionData)();
                (0, ui_1.showTodoList)(session.todos);
                continue;
            }
            ui_1.log.warning(`Unknown command: ${cmd}. Type "/" for menu.`);
            continue;
        }
        // Process user input with chat handler
        await chatHandler.processUserInput(userInput);
    }
});
program.parse(process.argv);
