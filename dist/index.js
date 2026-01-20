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
const groq_models_1 = require("./lib/groq-models");
// Import chat handler and safety
const chat_handler_1 = require("./lib/chat-handler");
const safety_1 = require("./lib/safety");
const tracker_1 = require("./lib/tracker");
// Cache for available models
let cachedModels = [];
const program = new commander_1.Command();
program
    .name("prab-cli")
    .description("An AI coding assistant with autonomous tool capabilities")
    .version("2.0.0");
// Config command
program
    .command("config [key]")
    .description("Set your Groq API Key")
    .action(async (key) => {
    if (key) {
        (0, config_1.setApiKey)(key.trim());
        ui_1.log.success("API Key saved successfully!");
        return;
    }
    const { inputKey } = await inquirer_1.default.prompt([
        {
            type: "password",
            name: "inputKey",
            message: "Enter your Groq API Key:",
            mask: "*",
        },
    ]);
    (0, config_1.setApiKey)(inputKey.trim());
    ui_1.log.success("API Key saved successfully!");
});
// Reset command
program
    .command("reset")
    .description("Clear your stored API Key")
    .action(() => {
    (0, config_1.clearApiKey)();
    ui_1.log.success("API Key cleared!");
});
// Model management commands
program
    .command("model")
    .description("Manage AI models")
    .action(async () => {
    const { action } = await inquirer_1.default.prompt([
        {
            type: "list",
            name: "action",
            message: "Model Management:",
            choices: [
                { name: "List available models", value: "list" },
                { name: "Show current model", value: "current" },
                { name: "Switch model", value: "switch" },
                { name: "Cancel", value: "cancel" },
            ],
        },
    ]);
    if (action === "list") {
        console.log("\nAvailable Models:\n");
        console.log((0, registry_1.getModelList)());
    }
    else if (action === "current") {
        const config = (0, config_1.getModelConfig)();
        ui_1.log.info(`Current model: ${config.modelId}`);
        ui_1.log.info(`Temperature: ${config.temperature}`);
    }
    else if (action === "switch") {
        const { modelId } = await inquirer_1.default.prompt([
            {
                type: "input",
                name: "modelId",
                message: "Enter model ID:",
            },
        ]);
        const validation = (0, registry_1.validateModelId)(modelId);
        if (validation.valid) {
            (0, config_1.setActiveModel)(modelId);
            ui_1.log.success(`Switched to model: ${modelId}`);
        }
        else {
            ui_1.log.error(validation.error || "Invalid model");
            if (validation.suggested) {
                ui_1.log.info(`Did you mean: ${validation.suggested}?`);
            }
        }
    }
});
// Main interactive mode
program.action(async () => {
    // Check API Key
    let apiKey = (0, config_1.getApiKey)();
    if (!apiKey) {
        ui_1.log.warning("No API Key found.");
        const { key } = await inquirer_1.default.prompt([
            {
                type: "password",
                name: "key",
                message: "Please enter your Groq API Key to get started:",
                mask: "*",
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
        tracker_1.tracker.modelInit(modelConfig.modelId, "groq", true);
        tracker_1.tracker.sessionStart(modelConfig.modelId, toolRegistry.count());
    }
    catch (e) {
        ui_1.log.error("Failed to initialize model.");
        tracker_1.tracker.modelInit(modelConfig.modelId, "groq", false, e.message);
        process.exit(1);
    }
    // Display banner
    (0, ui_1.banner)(modelConfig.modelId, toolRegistry.count());
    // Context Gathering
    const spinner = (0, ora_1.default)("Checking context...").start();
    const isRepo = await (0, context_1.isGitRepo)();
    let contextMessage = "";
    if (isRepo) {
        spinner.text = "Git repository detected. Gathering file structure...";
        const files = await (0, context_1.getFileTree)();
        contextMessage = `\n\nCurrent Working Directory Context:\nFile List:\n${files.join("\n")}`;
        spinner.succeed(`Context loaded (${files.length} files detected).`);
    }
    else {
        spinner.succeed("No Git repository detected. Running in standalone mode.");
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
                type: "input",
                name: "userInput",
                message: ">",
            },
        ]);
        // Handle Slash Commands Menu
        if (userInput.trim() === "/") {
            const currentModel = modelProvider.modelId;
            console.log("\n┌────────────────────────────────────────┐");
            console.log("│           AVAILABLE COMMANDS           │");
            console.log("└────────────────────────────────────────┘\n");
            const { action } = await inquirer_1.default.prompt([
                {
                    type: "list",
                    name: "action",
                    message: "Choose an option:",
                    choices: [
                        "1. Select Model",
                        "2. Usage",
                        "3. Tools",
                        "4. Todos",
                        "5. Clear Todos",
                        "6. Context",
                        "7. Clear History",
                        "8. API Key",
                        "9. Exit",
                    ],
                },
            ]);
            // Select Model - Toggle between different models
            if (action === "1. Select Model") {
                // Fetch models from Groq API if not cached
                if (cachedModels.length === 0) {
                    const spinner = (0, ora_1.default)("Fetching available models from Groq...").start();
                    cachedModels = await (0, groq_models_1.fetchGroqModels)(apiKey);
                    spinner.succeed(`Found ${cachedModels.length} models`);
                }
                // Group models by owner
                const grouped = (0, groq_models_1.groupModelsByOwner)(cachedModels);
                const modelChoices = [];
                // Build choices grouped by owner
                for (const [owner, models] of grouped) {
                    modelChoices.push(new inquirer_1.default.Separator(`─── ${owner} ───`));
                    for (const model of models) {
                        const isCurrent = model.id === currentModel;
                        const ctx = (0, groq_models_1.formatContextWindow)(model.context_window);
                        modelChoices.push({
                            name: `${isCurrent ? "✓ " : "  "}${model.id} (${ctx} ctx)`,
                            value: model.id,
                            short: model.id,
                        });
                    }
                }
                const { selectedModel } = await inquirer_1.default.prompt([
                    {
                        type: "list",
                        name: "selectedModel",
                        message: `Select a model (current: ${currentModel}):`,
                        choices: modelChoices,
                        pageSize: 15,
                        loop: false,
                    },
                ]);
                if (selectedModel && selectedModel !== currentModel) {
                    const oldModel = currentModel;
                    (0, config_1.setActiveModel)(selectedModel);
                    modelProvider.setModel(selectedModel);
                    ui_1.log.success(`Switched to model: ${selectedModel}`);
                    tracker_1.tracker.modelSwitch(oldModel, selectedModel, true);
                }
                else if (selectedModel === currentModel) {
                    ui_1.log.info(`Already using ${selectedModel}`);
                }
                continue;
            }
            // Usage - Show model usage and stats
            if (action === "2. Usage") {
                console.log("\n┌─────────────────────────────────────┐");
                console.log("│           MODEL USAGE               │");
                console.log("└─────────────────────────────────────┘\n");
                console.log(`  Current Model: ${currentModel}`);
                // Find model in cache and show details
                if (cachedModels.length === 0) {
                    const spinner = (0, ora_1.default)("Fetching model info...").start();
                    cachedModels = await (0, groq_models_1.fetchGroqModels)(apiKey);
                    spinner.stop();
                }
                const modelInfo = cachedModels.find((m) => m.id === currentModel);
                if (modelInfo) {
                    console.log(`  Provider:      ${modelInfo.owned_by}`);
                    console.log(`  Context:       ${(0, groq_models_1.formatContextWindow)(modelInfo.context_window)} tokens`);
                    console.log(`  Status:        ${modelInfo.active ? "Active" : "Inactive"}`);
                }
                console.log("\n┌─────────────────────────────────────┐");
                console.log("│          SESSION STATS              │");
                console.log("└─────────────────────────────────────┘\n");
                console.log(`  Messages:      ${chatHandler.getMessageCount()}`);
                console.log(`  Tools:         ${toolRegistry.count()} available`);
                console.log(`  Session ID:    ${tracker_1.tracker.getSessionId()}`);
                console.log("");
                continue;
            }
            if (action === "3. Tools") {
                console.log("\n┌─────────────────────────────────────┐");
                console.log("│         AVAILABLE TOOLS             │");
                console.log("└─────────────────────────────────────┘\n");
                console.log(toolRegistry.getToolDescriptions());
                console.log("");
                continue;
            }
            if (action === "4. Todos") {
                const session = (0, config_2.getSessionData)();
                (0, ui_1.showTodoList)(session.todos);
                continue;
            }
            if (action === "5. Clear Todos") {
                (0, config_1.clearSessionData)();
                ui_1.log.success("Todos cleared.");
                continue;
            }
            if (action === "6. Context") {
                console.log("\n┌─────────────────────────────────────┐");
                console.log("│          FILE CONTEXT               │");
                console.log("└─────────────────────────────────────┘\n");
                console.log(contextMessage || "  No context loaded.");
                console.log("");
                continue;
            }
            if (action === "7. Clear History") {
                chatHandler.clearHistory();
                ui_1.log.success("Chat history cleared.");
                continue;
            }
            if (action === "8. API Key") {
                const { key } = await inquirer_1.default.prompt([
                    {
                        type: "password",
                        name: "key",
                        message: "Enter new API Key:",
                        mask: "*",
                    },
                ]);
                (0, config_1.setApiKey)(key.trim());
                apiKey = key.trim();
                modelProvider.initialize(key.trim(), modelConfig.modelId);
                cachedModels = []; // Clear model cache
                ui_1.log.success("API Key updated.");
                continue;
            }
            if (action === "9. Exit")
                process.exit(0);
            continue;
        }
        // Handle direct slash commands
        if (userInput.startsWith("/")) {
            const cmd = userInput.trim().toLowerCase();
            if (cmd === "/exit" || cmd === "/quit")
                process.exit(0);
            if (cmd === "/clear") {
                chatHandler.clearHistory();
                ui_1.log.success("History cleared.");
                continue;
            }
            if (cmd === "/context") {
                ui_1.log.info(contextMessage || "No context.");
                continue;
            }
            if (cmd === "/tools") {
                console.log("\n📦 Available Tools:\n");
                console.log(toolRegistry.getToolDescriptions());
                console.log("");
                continue;
            }
            if (cmd === "/todos") {
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
