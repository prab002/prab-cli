#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const slash_commands_1 = require("./lib/slash-commands");
const select_1 = __importStar(require("@inquirer/select"));
const ora_1 = __importDefault(require("ora"));
// Import tool system
const base_1 = require("./lib/tools/base");
const executor_1 = require("./lib/tools/executor");
const file_tools_1 = require("./lib/tools/file-tools");
const shell_tools_1 = require("./lib/tools/shell-tools");
const git_tools_1 = require("./lib/tools/git-tools");
const todo_tool_1 = require("./lib/tools/todo-tool");
// Import crypto signal system
const crypto_1 = require("./lib/crypto");
// Import model system
const groq_provider_1 = require("./lib/models/groq-provider");
const registry_1 = require("./lib/models/registry");
const groq_models_1 = require("./lib/groq-models");
// Import chat handler and safety
const chat_handler_1 = require("./lib/chat-handler");
const safety_1 = require("./lib/safety");
const chalk_1 = __importDefault(require("chalk"));
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
// SMC (Smart Money Concepts) analysis command
program
    .command("smc <crypto>")
    .description("Smart Money Concepts analysis (Order Blocks, FVG, Liquidity)")
    .action(async (crypto) => {
    await (0, crypto_1.runSMCAnalysis)(crypto);
});
// Comprehensive analysis command
program
    .command("analyze <crypto>")
    .description("Deep market analysis with multi-timeframe & all indicators")
    .action(async (crypto) => {
    await (0, crypto_1.comprehensiveAnalysis)(crypto);
});
// Quick trading signal command
program
    .command("signal <crypto>")
    .description("Quick trading signal for a cryptocurrency (e.g., prab-cli signal btc)")
    .option("-i, --interval <interval>", "Time interval (1m, 5m, 15m, 1h, 4h, 1d, 1w)", "1h")
    .action(async (crypto, options) => {
    const validIntervals = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];
    const interval = validIntervals.includes(options.interval)
        ? options.interval
        : "1h";
    await (0, crypto_1.fullSignal)(crypto, interval);
});
// List supported cryptocurrencies
program
    .command("crypto-list")
    .description("List supported cryptocurrency symbols")
    .action(() => {
    console.log("\nSupported Cryptocurrencies:\n");
    const symbols = (0, crypto_1.getSupportedSymbols)();
    const columns = 4;
    for (let i = 0; i < symbols.length; i += columns) {
        const row = symbols
            .slice(i, i + columns)
            .map((s) => s.padEnd(12))
            .join("");
        console.log("  " + row);
    }
    console.log("\nYou can also use any Binance trading pair (e.g., BTCUSDT, ETHBTC)");
    console.log("");
});
// Whale activity tracker
program
    .command("whale")
    .description("Track whale activity (large BTC/ETH transactions)")
    .option("-c, --coins <coins>", "Coins to track (comma-separated)", "BTC,ETH")
    .action(async (options) => {
    const coins = options.coins.split(",").map((c) => c.trim().toUpperCase());
    await (0, crypto_1.runWhaleTracker)(coins);
});
// Market scanner for opportunities
program
    .command("scan")
    .description("Scan market for best trading opportunities")
    .option("-l, --limit <number>", "Number of cryptos to scan (max 100)", "50")
    .option("-m, --min-score <number>", "Minimum score to display", "50")
    .action(async (options) => {
    const limit = Math.min(parseInt(options.limit) || 50, 100);
    const minScore = parseInt(options.minScore) || 50;
    await (0, crypto_1.runMarketScanner)(limit, minScore);
});
// Crypto news fetcher
program
    .command("news")
    .description("Get latest cryptocurrency news and updates")
    .option("-c, --coin <coin>", "Filter news by specific coin (e.g., btc, eth)")
    .action(async (options) => {
    await (0, crypto_1.runCryptoNews)(options.coin);
});
// Smart trading strategy
program
    .command("strategy <crypto>")
    .description("Generate smart trading strategy with entry, exit, and leverage")
    .option("-s, --style <style>", "Trading style: conservative, moderate, aggressive", "moderate")
    .option("-l, --leverage <number>", "Maximum leverage allowed", "20")
    .option("-d, --direction <direction>", "Trade direction: both, long, short", "both")
    .action(async (crypto, options) => {
    const style = ["conservative", "moderate", "aggressive"].includes(options.style)
        ? options.style
        : "moderate";
    const maxLeverage = Math.min(parseInt(options.leverage) || 20, 100);
    const direction = ["both", "long", "short"].includes(options.direction)
        ? options.direction
        : "both";
    await (0, crypto_1.runStrategy)(crypto, { style, maxLeverage, direction });
});
// Order Block trading strategy
program
    .command("orderblock <crypto>")
    .alias("ob")
    .description("Order Block trading strategy with BUY/SELL signals based on OB zones")
    .option("-i, --interval <interval>", "Time interval (15m, 1h, 4h, 1d)", "4h")
    .action(async (crypto, options) => {
    const validIntervals = ["15m", "1h", "4h", "1d"];
    const interval = validIntervals.includes(options.interval)
        ? options.interval
        : "4h";
    await (0, crypto_1.runOrderBlockStrategy)(crypto, interval);
});
// ICT (Inner Circle Trader) Strategy
program
    .command("ict <crypto>")
    .description("ICT trading strategy - Killzones, OTE, Breakers, Silver Bullet, AMD")
    .option("-i, --interval <interval>", "Time interval (15m, 1h, 4h)", "1h")
    .action(async (crypto, options) => {
    const validIntervals = ["15m", "1h", "4h"];
    const interval = validIntervals.includes(options.interval)
        ? options.interval
        : "1h";
    await (0, crypto_1.runICTStrategy)(crypto, interval);
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
    // Display banner with customization
    const customization = (0, config_1.getCustomization)();
    (0, ui_1.banner)(modelConfig.modelId, toolRegistry.count(), customization);
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
    ui_1.log.info('Type "/" for commands (searchable), or start chatting!');
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
        // Handle Slash Commands
        if (userInput.trim() === "/" || userInput.trim().startsWith("/")) {
            const currentModel = modelProvider.modelId;
            // Show the searchable slash command menu
            const action = await (0, slash_commands_1.showSlashCommandMenu)();
            if (!action) {
                // User cancelled
                continue;
            }
            // Execute the selected command
            switch (action) {
                case "smc": {
                    // Prompt for crypto symbol
                    const { cryptoSymbol } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "cryptoSymbol",
                            message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
                            default: "btc",
                        },
                    ]);
                    await (0, crypto_1.runSMCAnalysis)(cryptoSymbol);
                    break;
                }
                case "analyze": {
                    // Prompt for crypto symbol
                    const { cryptoSymbol } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "cryptoSymbol",
                            message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
                            default: "btc",
                        },
                    ]);
                    try {
                        await (0, crypto_1.comprehensiveAnalysis)(cryptoSymbol);
                    }
                    catch (err) {
                        // Error already handled in comprehensiveAnalysis
                    }
                    break;
                }
                case "signal": {
                    // Prompt for crypto symbol
                    const { cryptoSymbol } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "cryptoSymbol",
                            message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
                            default: "btc",
                        },
                    ]);
                    // Prompt for interval
                    const intervalChoice = await (0, select_1.default)({
                        message: "Select time interval:",
                        choices: [
                            { name: "1 Hour (recommended)", value: "1h" },
                            { name: "15 Minutes", value: "15m" },
                            { name: "4 Hours", value: "4h" },
                            { name: "1 Day", value: "1d" },
                        ],
                    });
                    try {
                        await (0, crypto_1.fullSignal)(cryptoSymbol, intervalChoice);
                    }
                    catch (err) {
                        // Error already handled in fullSignal
                    }
                    break;
                }
                case "whale": {
                    // Prompt for coins to track
                    const { coins } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "coins",
                            message: "Enter coins to track (comma-separated):",
                            default: "BTC,ETH",
                        },
                    ]);
                    const coinList = coins.split(",").map((c) => c.trim().toUpperCase());
                    await (0, crypto_1.runWhaleTracker)(coinList);
                    break;
                }
                case "scan": {
                    // Prompt for scan options
                    const scanLimit = await (0, select_1.default)({
                        message: "How many cryptocurrencies to scan?",
                        choices: [
                            { name: "Top 20 (Quick)", value: 20 },
                            { name: "Top 50 (Recommended)", value: 50 },
                            { name: "Top 100 (Comprehensive)", value: 100 },
                        ],
                    });
                    await (0, crypto_1.runMarketScanner)(scanLimit, 50);
                    break;
                }
                case "news": {
                    // Prompt for optional coin filter
                    const newsFilterChoice = await (0, select_1.default)({
                        message: "Filter news by coin?",
                        choices: [
                            { name: "All Crypto News", value: "" },
                            { name: "Bitcoin (BTC)", value: "BTC" },
                            { name: "Ethereum (ETH)", value: "ETH" },
                            { name: "Solana (SOL)", value: "SOL" },
                            { name: "Other (specify)", value: "__other__" },
                        ],
                    });
                    let coinFilter;
                    if (newsFilterChoice === "__other__") {
                        const { customCoin } = await inquirer_1.default.prompt([
                            {
                                type: "input",
                                name: "customCoin",
                                message: "Enter coin symbol (e.g., XRP, ADA, DOGE):",
                            },
                        ]);
                        coinFilter = customCoin.trim().toUpperCase() || undefined;
                    }
                    else if (newsFilterChoice) {
                        coinFilter = newsFilterChoice;
                    }
                    await (0, crypto_1.runCryptoNews)(coinFilter);
                    break;
                }
                case "strategy": {
                    // Prompt for crypto symbol
                    const { strategySymbol } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "strategySymbol",
                            message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
                            default: "btc",
                        },
                    ]);
                    // Prompt for trading style
                    const styleChoice = await (0, select_1.default)({
                        message: "Select your trading style:",
                        choices: [
                            { name: "Conservative (5-10x leverage, wider stops)", value: "conservative" },
                            { name: "Moderate (10-20x leverage, balanced) - Recommended", value: "moderate" },
                            { name: "Aggressive (20-50x leverage, tighter stops)", value: "aggressive" },
                        ],
                    });
                    // Prompt for direction
                    const directionChoice = await (0, select_1.default)({
                        message: "Trade direction:",
                        choices: [
                            { name: "Both Long & Short", value: "both" },
                            { name: "Long Only", value: "long" },
                            { name: "Short Only", value: "short" },
                        ],
                    });
                    await (0, crypto_1.runStrategy)(strategySymbol, {
                        style: styleChoice,
                        direction: directionChoice,
                        maxLeverage: styleChoice === "conservative" ? 10 : styleChoice === "moderate" ? 20 : 50,
                    });
                    break;
                }
                case "orderblock": {
                    // Prompt for crypto symbol
                    const { obSymbol } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "obSymbol",
                            message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
                            default: "btc",
                        },
                    ]);
                    // Prompt for timeframe
                    const obIntervalChoice = await (0, select_1.default)({
                        message: "Select timeframe for Order Block analysis:",
                        choices: [
                            { name: "4 Hours (Recommended for swing trades)", value: "4h" },
                            { name: "1 Hour (Intraday trades)", value: "1h" },
                            { name: "15 Minutes (Scalping)", value: "15m" },
                            { name: "1 Day (Position trades)", value: "1d" },
                        ],
                    });
                    await (0, crypto_1.runOrderBlockStrategy)(obSymbol, obIntervalChoice);
                    break;
                }
                case "ict": {
                    // Prompt for crypto symbol
                    const { ictSymbol } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "ictSymbol",
                            message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
                            default: "btc",
                        },
                    ]);
                    // Prompt for timeframe
                    const ictIntervalChoice = await (0, select_1.default)({
                        message: "Select timeframe for ICT analysis:",
                        choices: [
                            { name: "1 Hour (Recommended for ICT)", value: "1h" },
                            { name: "15 Minutes (Scalping with Silver Bullet)", value: "15m" },
                            { name: "4 Hours (Higher timeframe bias)", value: "4h" },
                        ],
                    });
                    await (0, crypto_1.runICTStrategy)(ictSymbol, ictIntervalChoice);
                    break;
                }
                case "model": {
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
                        modelChoices.push(new select_1.Separator(`─── ${owner} ───`));
                        for (const model of models) {
                            const isCurrent = model.id === currentModel;
                            const ctx = (0, groq_models_1.formatContextWindow)(model.context_window);
                            modelChoices.push({
                                name: `${isCurrent ? "✓ " : "  "}${model.id} (${ctx} ctx)`,
                                value: model.id,
                            });
                        }
                    }
                    try {
                        const selectedModel = await (0, select_1.default)({
                            message: `Select a model (current: ${currentModel}):`,
                            choices: modelChoices,
                            pageSize: 15,
                            loop: false,
                        });
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
                    }
                    catch {
                        // User cancelled with Ctrl+C
                    }
                    break;
                }
                case "usage": {
                    console.log("\n┌─────────────────────────────────────┐");
                    console.log("│           MODEL INFO                │");
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
                    console.log("│         TOKEN CONSUMPTION           │");
                    console.log("└─────────────────────────────────────┘\n");
                    const usageStats = chatHandler.getUsageStats();
                    console.log(`  Prompt Tokens:     ${usageStats.promptTokens.toLocaleString()}`);
                    console.log(`  Completion Tokens: ${usageStats.completionTokens.toLocaleString()}`);
                    console.log(`  Total Tokens:      ${usageStats.totalTokens.toLocaleString()}`);
                    console.log(`  API Requests:      ${usageStats.requestCount}`);
                    console.log("\n┌─────────────────────────────────────┐");
                    console.log("│          SESSION STATS              │");
                    console.log("└─────────────────────────────────────┘\n");
                    console.log(`  Messages:      ${chatHandler.getMessageCount()}`);
                    console.log(`  Tools:         ${toolRegistry.count()} available`);
                    console.log(`  Session ID:    ${tracker_1.tracker.getSessionId()}`);
                    console.log("");
                    break;
                }
                case "tools": {
                    console.log("\n┌─────────────────────────────────────┐");
                    console.log("│         AVAILABLE TOOLS             │");
                    console.log("└─────────────────────────────────────┘\n");
                    console.log(toolRegistry.getToolDescriptions());
                    console.log("");
                    break;
                }
                case "todos": {
                    const session = (0, config_2.getSessionData)();
                    (0, ui_1.showTodoList)(session.todos);
                    break;
                }
                case "clear-todos": {
                    (0, config_1.clearSessionData)();
                    ui_1.log.success("Todos cleared.");
                    break;
                }
                case "context": {
                    console.log("\n┌─────────────────────────────────────┐");
                    console.log("│          FILE CONTEXT               │");
                    console.log("└─────────────────────────────────────┘\n");
                    console.log(contextMessage || "  No context loaded.");
                    console.log("");
                    break;
                }
                case "clear": {
                    chatHandler.clearHistory();
                    ui_1.log.success("Chat history cleared.");
                    break;
                }
                case "api-key": {
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
                    break;
                }
                case "settings": {
                    console.log("\n┌─────────────────────────────────────┐");
                    console.log("│         CUSTOMIZATION               │");
                    console.log("└─────────────────────────────────────┘\n");
                    const currentCustomization = (0, config_1.getCustomization)();
                    console.log(chalk_1.default.gray(`  Current CLI Name: ${chalk_1.default.cyan(currentCustomization.cliName)}`));
                    console.log(chalk_1.default.gray(`  Current User: ${chalk_1.default.cyan(currentCustomization.userName || "(not set)")}`));
                    console.log(chalk_1.default.gray(`  Current Theme: ${chalk_1.default.cyan(currentCustomization.theme)}`));
                    console.log("");
                    try {
                        const settingChoice = await (0, select_1.default)({
                            message: "What would you like to customize?",
                            choices: [
                                { name: "Change CLI Name (banner text)", value: "cli-name" },
                                { name: "Set Your Name (greeting)", value: "user-name" },
                                {
                                    name: "Change Theme (default, minimal, colorful)",
                                    value: "theme",
                                },
                                { name: "Reset to Defaults", value: "reset" },
                                { name: "Cancel", value: "cancel" },
                            ],
                        });
                        if (settingChoice === "cli-name") {
                            const { newName } = await inquirer_1.default.prompt([
                                {
                                    type: "input",
                                    name: "newName",
                                    message: "Enter new CLI name (e.g., 'My CLI', 'Dev Tool'):",
                                    default: currentCustomization.cliName,
                                },
                            ]);
                            if (newName && newName.trim()) {
                                (0, config_1.setCliName)(newName.trim());
                                ui_1.log.success(`CLI name changed to: ${newName.trim()}`);
                                ui_1.log.info("Restart the CLI to see the new banner.");
                            }
                        }
                        else if (settingChoice === "user-name") {
                            const { newUserName } = await inquirer_1.default.prompt([
                                {
                                    type: "input",
                                    name: "newUserName",
                                    message: "Enter your name (for greeting):",
                                    default: currentCustomization.userName || "",
                                },
                            ]);
                            if (newUserName && newUserName.trim()) {
                                (0, config_1.setUserName)(newUserName.trim());
                                ui_1.log.success(`Welcome message will now greet: ${newUserName.trim()}`);
                            }
                        }
                        else if (settingChoice === "theme") {
                            const themeChoice = await (0, select_1.default)({
                                message: "Select a theme:",
                                choices: [
                                    { name: "Default (Cyan)", value: "default" },
                                    { name: "Minimal (White)", value: "minimal" },
                                    { name: "Colorful (Magenta)", value: "colorful" },
                                ],
                            });
                            (0, config_1.setTheme)(themeChoice);
                            ui_1.log.success(`Theme changed to: ${themeChoice}`);
                            ui_1.log.info("Restart the CLI to see the new theme.");
                        }
                        else if (settingChoice === "reset") {
                            (0, config_1.resetCustomization)();
                            ui_1.log.success("Customization reset to defaults.");
                        }
                    }
                    catch {
                        // User cancelled
                    }
                    break;
                }
                case "exit": {
                    process.exit(0);
                }
            }
            continue;
        }
        // Process user input with chat handler
        const result = await chatHandler.processUserInput(userInput);
        // Handle model errors - offer to switch models
        if (!result.success && result.isModelError) {
            console.log("");
            console.log(chalk_1.default.yellow("┌─────────────────────────────────────────────────────┐"));
            console.log(chalk_1.default.yellow("│") +
                chalk_1.default.red.bold("  Model Error Detected                               ") +
                chalk_1.default.yellow("│"));
            console.log(chalk_1.default.yellow("└─────────────────────────────────────────────────────┘"));
            const errorMessages = {
                rate_limit: "Rate limit exceeded. The model is receiving too many requests.",
                model_unavailable: "Model is currently unavailable or overloaded.",
                auth_error: "Authentication error. Please check your API key.",
                unknown: "An error occurred with the current model.",
            };
            console.log(chalk_1.default.dim(`  ${errorMessages[result.errorType || "unknown"]}`));
            console.log("");
            console.log(chalk_1.default.cyan("  Would you like to switch to a different model?"));
            console.log("");
            // Fetch models if not cached
            if (cachedModels.length === 0) {
                const spinner = (0, ora_1.default)("Fetching available models...").start();
                cachedModels = await (0, groq_models_1.fetchGroqModels)(apiKey);
                spinner.succeed(`Found ${cachedModels.length} models`);
            }
            // Filter out the current model and build choices
            const currentModel = modelProvider.modelId;
            const availableModels = cachedModels.filter((m) => m.id !== currentModel);
            const grouped = (0, groq_models_1.groupModelsByOwner)(availableModels);
            const modelChoices = [];
            // Add "Cancel" option first
            modelChoices.push({
                name: chalk_1.default.dim("  Cancel (keep current model)"),
                value: "__cancel__",
            });
            modelChoices.push(new select_1.Separator("─── Available Models ───"));
            for (const [owner, models] of grouped) {
                modelChoices.push(new select_1.Separator(`─── ${owner} ───`));
                for (const model of models) {
                    const ctx = (0, groq_models_1.formatContextWindow)(model.context_window);
                    modelChoices.push({
                        name: `  ${model.id} (${ctx} ctx)`,
                        value: model.id,
                    });
                }
            }
            try {
                const selectedModel = await (0, select_1.default)({
                    message: "Select a model to switch to:",
                    choices: modelChoices,
                    pageSize: 12,
                    loop: false,
                });
                if (selectedModel && selectedModel !== "__cancel__") {
                    const oldModel = currentModel;
                    (0, config_1.setActiveModel)(selectedModel);
                    modelProvider.setModel(selectedModel);
                    chatHandler.updateModelProvider(modelProvider);
                    ui_1.log.success(`Switched to model: ${selectedModel}`);
                    tracker_1.tracker.modelSwitch(oldModel, selectedModel, true);
                    // Ask if user wants to retry the last message
                    console.log("");
                    const { retry } = await inquirer_1.default.prompt([
                        {
                            type: "confirm",
                            name: "retry",
                            message: "Retry your last message with the new model?",
                            default: true,
                        },
                    ]);
                    if (retry) {
                        console.log(chalk_1.default.dim("Retrying with new model..."));
                        await chatHandler.processUserInput(userInput);
                    }
                }
                else {
                    ui_1.log.info("Keeping current model. You can try again or switch models with /model");
                }
            }
            catch {
                // User cancelled with Ctrl+C
                ui_1.log.info("Model switch cancelled.");
            }
        }
    }
});
program.parse(process.argv);
