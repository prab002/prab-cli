#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getModelConfig,
  setActiveModel,
  clearSessionData,
  getCustomization,
  setCliName,
  setUserName,
  setTheme,
  resetCustomization,
} from "./lib/config";
import { isGitRepo, getFileTree } from "./lib/context";
import { log, banner, showTodoList } from "./lib/ui";
import { getSessionData } from "./lib/config";
import { showSlashCommandMenu } from "./lib/slash-commands";
import select, { Separator } from "@inquirer/select";
import ora from "ora";

// Import tool system
import { ToolRegistry } from "./lib/tools/base";
import { ToolExecutor } from "./lib/tools/executor";
import {
  ReadFileTool,
  WriteFileTool,
  EditFileTool,
  GlobTool,
  GrepTool,
} from "./lib/tools/file-tools";
import { BashTool } from "./lib/tools/shell-tools";
import {
  GitStatusTool,
  GitAddTool,
  GitDiffTool,
  GitLogTool,
  GitCommitTool,
  GitBranchTool,
  GitPushTool,
} from "./lib/tools/git-tools";
import { TodoTool } from "./lib/tools/todo-tool";

// Import crypto signal system
import {
  fullSignal,
  comprehensiveAnalysis,
  runSMCAnalysis,
  runWhaleTracker,
  runMarketScanner,
  runCryptoNews,
  runStrategy,
  runOrderBlockStrategy,
  runICTStrategy,
  getSupportedSymbols,
  TimeInterval,
} from "./lib/crypto";

// Import model system
import { GroqProvider } from "./lib/models/groq-provider";
import { getModelList, validateModelId } from "./lib/models/registry";
import {
  fetchGroqModels,
  groupModelsByOwner,
  formatContextWindow,
  GroqModel,
} from "./lib/groq-models";

// Import chat handler and safety
import { ChatHandler } from "./lib/chat-handler";
import { SafetyChecker } from "./lib/safety";
import chalk from "chalk";
import { tracker } from "./lib/tracker";

// Cache for available models
let cachedModels: GroqModel[] = [];

const program = new Command();

program
  .name("prab-cli")
  .description("An AI coding assistant with autonomous tool capabilities")
  .version("2.0.0");

// Config command
program
  .command("config [key]")
  .description("Set your Groq API Key")
  .action(async (key?: string) => {
    if (key) {
      setApiKey(key.trim());
      log.success("API Key saved successfully!");
      return;
    }
    const { inputKey } = await inquirer.prompt([
      {
        type: "password",
        name: "inputKey",
        message: "Enter your Groq API Key:",
        mask: "*",
      },
    ]);
    setApiKey(inputKey.trim());
    log.success("API Key saved successfully!");
  });

// Reset command
program
  .command("reset")
  .description("Clear your stored API Key")
  .action(() => {
    clearApiKey();
    log.success("API Key cleared!");
  });

// SMC (Smart Money Concepts) analysis command
program
  .command("smc <crypto>")
  .description("Smart Money Concepts analysis (Order Blocks, FVG, Liquidity)")
  .action(async (crypto: string) => {
    await runSMCAnalysis(crypto);
  });

// Comprehensive analysis command
program
  .command("analyze <crypto>")
  .description("Deep market analysis with multi-timeframe & all indicators")
  .action(async (crypto: string) => {
    await comprehensiveAnalysis(crypto);
  });

// Quick trading signal command
program
  .command("signal <crypto>")
  .description("Quick trading signal for a cryptocurrency (e.g., prab-cli signal btc)")
  .option("-i, --interval <interval>", "Time interval (1m, 5m, 15m, 1h, 4h, 1d, 1w)", "1h")
  .action(async (crypto: string, options: { interval: string }) => {
    const validIntervals = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];
    const interval = validIntervals.includes(options.interval)
      ? (options.interval as TimeInterval)
      : "1h";

    await fullSignal(crypto, interval);
  });

// List supported cryptocurrencies
program
  .command("crypto-list")
  .description("List supported cryptocurrency symbols")
  .action(() => {
    console.log("\nSupported Cryptocurrencies:\n");
    const symbols = getSupportedSymbols();
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
  .action(async (options: { coins: string }) => {
    const coins = options.coins.split(",").map((c) => c.trim().toUpperCase());
    await runWhaleTracker(coins);
  });

// Market scanner for opportunities
program
  .command("scan")
  .description("Scan market for best trading opportunities")
  .option("-l, --limit <number>", "Number of cryptos to scan (max 100)", "50")
  .option("-m, --min-score <number>", "Minimum score to display", "50")
  .action(async (options: { limit: string; minScore: string }) => {
    const limit = Math.min(parseInt(options.limit) || 50, 100);
    const minScore = parseInt(options.minScore) || 50;
    await runMarketScanner(limit, minScore);
  });

// Crypto news fetcher
program
  .command("news")
  .description("Get latest cryptocurrency news and updates")
  .option("-c, --coin <coin>", "Filter news by specific coin (e.g., btc, eth)")
  .action(async (options: { coin?: string }) => {
    await runCryptoNews(options.coin);
  });

// Smart trading strategy
program
  .command("strategy <crypto>")
  .description("Generate smart trading strategy with entry, exit, and leverage")
  .option("-s, --style <style>", "Trading style: conservative, moderate, aggressive", "moderate")
  .option("-l, --leverage <number>", "Maximum leverage allowed", "20")
  .option("-d, --direction <direction>", "Trade direction: both, long, short", "both")
  .action(
    async (crypto: string, options: { style: string; leverage: string; direction: string }) => {
      const style = ["conservative", "moderate", "aggressive"].includes(options.style)
        ? (options.style as "conservative" | "moderate" | "aggressive")
        : "moderate";
      const maxLeverage = Math.min(parseInt(options.leverage) || 20, 100);
      const direction = ["both", "long", "short"].includes(options.direction)
        ? (options.direction as "both" | "long" | "short")
        : "both";

      await runStrategy(crypto, { style, maxLeverage, direction });
    }
  );

// Order Block trading strategy
program
  .command("orderblock <crypto>")
  .alias("ob")
  .description("Order Block trading strategy with BUY/SELL signals based on OB zones")
  .option("-i, --interval <interval>", "Time interval (15m, 1h, 4h, 1d)", "4h")
  .action(async (crypto: string, options: { interval: string }) => {
    const validIntervals = ["15m", "1h", "4h", "1d"];
    const interval = validIntervals.includes(options.interval)
      ? (options.interval as TimeInterval)
      : "4h";

    await runOrderBlockStrategy(crypto, interval);
  });

// ICT (Inner Circle Trader) Strategy
program
  .command("ict <crypto>")
  .description("ICT trading strategy - Killzones, OTE, Breakers, Silver Bullet, AMD")
  .option("-i, --interval <interval>", "Time interval (15m, 1h, 4h)", "1h")
  .action(async (crypto: string, options: { interval: string }) => {
    const validIntervals = ["15m", "1h", "4h"];
    const interval = validIntervals.includes(options.interval)
      ? (options.interval as TimeInterval)
      : "1h";

    await runICTStrategy(crypto, interval);
  });

// Model management commands
program
  .command("model")
  .description("Manage AI models")
  .action(async () => {
    const { action } = await inquirer.prompt([
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
      console.log(getModelList());
    } else if (action === "current") {
      const config = getModelConfig();
      log.info(`Current model: ${config.modelId}`);
      log.info(`Temperature: ${config.temperature}`);
    } else if (action === "switch") {
      const { modelId } = await inquirer.prompt([
        {
          type: "input",
          name: "modelId",
          message: "Enter model ID:",
        },
      ]);

      const validation = validateModelId(modelId);
      if (validation.valid) {
        setActiveModel(modelId);
        log.success(`Switched to model: ${modelId}`);
      } else {
        log.error(validation.error || "Invalid model");
        if (validation.suggested) {
          log.info(`Did you mean: ${validation.suggested}?`);
        }
      }
    }
  });

// Main interactive mode
program.action(async () => {
  // Check API Key
  let apiKey = getApiKey();
  if (!apiKey) {
    log.warning("No API Key found.");
    const { key } = await inquirer.prompt([
      {
        type: "password",
        name: "key",
        message: "Please enter your Groq API Key to get started:",
        mask: "*",
      },
    ]);
    setApiKey(key.trim());
    apiKey = key.trim();
  }

  // Initialize tool registry
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new ReadFileTool());
  toolRegistry.register(new WriteFileTool());
  toolRegistry.register(new EditFileTool());
  toolRegistry.register(new GlobTool());
  toolRegistry.register(new GrepTool());
  toolRegistry.register(new BashTool());
  toolRegistry.register(new GitStatusTool());
  toolRegistry.register(new GitAddTool());
  toolRegistry.register(new GitDiffTool());
  toolRegistry.register(new GitLogTool());
  toolRegistry.register(new GitCommitTool());
  toolRegistry.register(new GitBranchTool());
  toolRegistry.register(new GitPushTool());
  toolRegistry.register(new TodoTool());

  // Initialize safety checker and tool executor
  const safetyChecker = new SafetyChecker();
  const toolExecutor = new ToolExecutor(toolRegistry, safetyChecker);

  // Initialize model provider
  const modelConfig = getModelConfig();
  const modelProvider = new GroqProvider(modelConfig.modelId, modelConfig.temperature);
  try {
    modelProvider.initialize(apiKey, modelConfig.modelId);
    tracker.modelInit(modelConfig.modelId, "groq", true);
    tracker.sessionStart(modelConfig.modelId, toolRegistry.count());
  } catch (e: any) {
    log.error("Failed to initialize model.");
    tracker.modelInit(modelConfig.modelId, "groq", false, e.message);
    process.exit(1);
  }

  // Display banner with customization
  const customization = getCustomization();
  banner(modelConfig.modelId, toolRegistry.count(), customization);

  // Context Gathering
  const spinner = ora("Checking context...").start();
  const isRepo = await isGitRepo();
  let contextMessage = "";

  if (isRepo) {
    spinner.text = "Git repository detected. Gathering file structure...";
    const files = await getFileTree();
    contextMessage = `\n\nCurrent Working Directory Context:\nFile List:\n${files.join("\n")}`;
    spinner.succeed(`Context loaded (${files.length} files detected).`);
  } else {
    spinner.succeed("No Git repository detected. Running in standalone mode.");
  }

  // Initialize chat handler
  const chatHandler = new ChatHandler(toolRegistry, toolExecutor, modelProvider, contextMessage);

  log.info('Type "/" for commands (searchable), or start chatting!');

  // Display any existing todos
  const session = getSessionData();
  if (session.todos && session.todos.length > 0) {
    showTodoList(session.todos);
  }

  // Chat Loop
  while (true) {
    const { userInput } = await inquirer.prompt([
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
      const action = await showSlashCommandMenu();

      if (!action) {
        // User cancelled
        continue;
      }

      // Execute the selected command
      switch (action) {
        case "smc": {
          // Prompt for crypto symbol
          const { cryptoSymbol } = await inquirer.prompt([
            {
              type: "input",
              name: "cryptoSymbol",
              message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
              default: "btc",
            },
          ]);

          await runSMCAnalysis(cryptoSymbol);
          break;
        }

        case "analyze": {
          // Prompt for crypto symbol
          const { cryptoSymbol } = await inquirer.prompt([
            {
              type: "input",
              name: "cryptoSymbol",
              message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
              default: "btc",
            },
          ]);

          try {
            await comprehensiveAnalysis(cryptoSymbol);
          } catch (err) {
            // Error already handled in comprehensiveAnalysis
          }
          break;
        }

        case "signal": {
          // Prompt for crypto symbol
          const { cryptoSymbol } = await inquirer.prompt([
            {
              type: "input",
              name: "cryptoSymbol",
              message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
              default: "btc",
            },
          ]);

          // Prompt for interval
          const intervalChoice = await select({
            message: "Select time interval:",
            choices: [
              { name: "1 Hour (recommended)", value: "1h" },
              { name: "15 Minutes", value: "15m" },
              { name: "4 Hours", value: "4h" },
              { name: "1 Day", value: "1d" },
            ],
          });

          try {
            await fullSignal(cryptoSymbol, intervalChoice as TimeInterval);
          } catch (err) {
            // Error already handled in fullSignal
          }
          break;
        }

        case "whale": {
          // Prompt for coins to track
          const { coins } = await inquirer.prompt([
            {
              type: "input",
              name: "coins",
              message: "Enter coins to track (comma-separated):",
              default: "BTC,ETH",
            },
          ]);

          const coinList = coins.split(",").map((c: string) => c.trim().toUpperCase());
          await runWhaleTracker(coinList);
          break;
        }

        case "scan": {
          // Prompt for scan options
          const scanLimit = await select({
            message: "How many cryptocurrencies to scan?",
            choices: [
              { name: "Top 20 (Quick)", value: 20 },
              { name: "Top 50 (Recommended)", value: 50 },
              { name: "Top 100 (Comprehensive)", value: 100 },
            ],
          });

          await runMarketScanner(scanLimit as number, 50);
          break;
        }

        case "news": {
          // Prompt for optional coin filter
          const newsFilterChoice = await select({
            message: "Filter news by coin?",
            choices: [
              { name: "All Crypto News", value: "" },
              { name: "Bitcoin (BTC)", value: "BTC" },
              { name: "Ethereum (ETH)", value: "ETH" },
              { name: "Solana (SOL)", value: "SOL" },
              { name: "Other (specify)", value: "__other__" },
            ],
          });

          let coinFilter: string | undefined;
          if (newsFilterChoice === "__other__") {
            const { customCoin } = await inquirer.prompt([
              {
                type: "input",
                name: "customCoin",
                message: "Enter coin symbol (e.g., XRP, ADA, DOGE):",
              },
            ]);
            coinFilter = customCoin.trim().toUpperCase() || undefined;
          } else if (newsFilterChoice) {
            coinFilter = newsFilterChoice;
          }

          await runCryptoNews(coinFilter);
          break;
        }

        case "strategy": {
          // Prompt for crypto symbol
          const { strategySymbol } = await inquirer.prompt([
            {
              type: "input",
              name: "strategySymbol",
              message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
              default: "btc",
            },
          ]);

          // Prompt for trading style
          const styleChoice = await select({
            message: "Select your trading style:",
            choices: [
              { name: "Conservative (5-10x leverage, wider stops)", value: "conservative" },
              { name: "Moderate (10-20x leverage, balanced) - Recommended", value: "moderate" },
              { name: "Aggressive (20-50x leverage, tighter stops)", value: "aggressive" },
            ],
          });

          // Prompt for direction
          const directionChoice = await select({
            message: "Trade direction:",
            choices: [
              { name: "Both Long & Short", value: "both" },
              { name: "Long Only", value: "long" },
              { name: "Short Only", value: "short" },
            ],
          });

          await runStrategy(strategySymbol, {
            style: styleChoice as "conservative" | "moderate" | "aggressive",
            direction: directionChoice as "both" | "long" | "short",
            maxLeverage: styleChoice === "conservative" ? 10 : styleChoice === "moderate" ? 20 : 50,
          });
          break;
        }

        case "orderblock": {
          // Prompt for crypto symbol
          const { obSymbol } = await inquirer.prompt([
            {
              type: "input",
              name: "obSymbol",
              message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
              default: "btc",
            },
          ]);

          // Prompt for timeframe
          const obIntervalChoice = await select({
            message: "Select timeframe for Order Block analysis:",
            choices: [
              { name: "4 Hours (Recommended for swing trades)", value: "4h" },
              { name: "1 Hour (Intraday trades)", value: "1h" },
              { name: "15 Minutes (Scalping)", value: "15m" },
              { name: "1 Day (Position trades)", value: "1d" },
            ],
          });

          await runOrderBlockStrategy(obSymbol, obIntervalChoice as TimeInterval);
          break;
        }

        case "ict": {
          // Prompt for crypto symbol
          const { ictSymbol } = await inquirer.prompt([
            {
              type: "input",
              name: "ictSymbol",
              message: "Enter cryptocurrency symbol (e.g., btc, eth, sol):",
              default: "btc",
            },
          ]);

          // Prompt for timeframe
          const ictIntervalChoice = await select({
            message: "Select timeframe for ICT analysis:",
            choices: [
              { name: "1 Hour (Recommended for ICT)", value: "1h" },
              { name: "15 Minutes (Scalping with Silver Bullet)", value: "15m" },
              { name: "4 Hours (Higher timeframe bias)", value: "4h" },
            ],
          });

          await runICTStrategy(ictSymbol, ictIntervalChoice as TimeInterval);
          break;
        }

        case "model": {
          // Fetch models from Groq API if not cached
          if (cachedModels.length === 0) {
            const spinner = ora("Fetching available models from Groq...").start();
            cachedModels = await fetchGroqModels(apiKey);
            spinner.succeed(`Found ${cachedModels.length} models`);
          }

          // Group models by owner
          const grouped = groupModelsByOwner(cachedModels);
          const modelChoices: Array<{ name: string; value: string } | Separator> = [];

          // Build choices grouped by owner
          for (const [owner, models] of grouped) {
            modelChoices.push(new Separator(`─── ${owner} ───`));
            for (const model of models) {
              const isCurrent = model.id === currentModel;
              const ctx = formatContextWindow(model.context_window);
              modelChoices.push({
                name: `${isCurrent ? "✓ " : "  "}${model.id} (${ctx} ctx)`,
                value: model.id,
              });
            }
          }

          try {
            const selectedModel = await select({
              message: `Select a model (current: ${currentModel}):`,
              choices: modelChoices,
              pageSize: 15,
              loop: false,
            });

            if (selectedModel && selectedModel !== currentModel) {
              const oldModel = currentModel;
              setActiveModel(selectedModel);
              modelProvider.setModel(selectedModel);
              log.success(`Switched to model: ${selectedModel}`);
              tracker.modelSwitch(oldModel, selectedModel, true);
            } else if (selectedModel === currentModel) {
              log.info(`Already using ${selectedModel}`);
            }
          } catch {
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
            const spinner = ora("Fetching model info...").start();
            cachedModels = await fetchGroqModels(apiKey);
            spinner.stop();
          }

          const modelInfo = cachedModels.find((m) => m.id === currentModel);
          if (modelInfo) {
            console.log(`  Provider:      ${modelInfo.owned_by}`);
            console.log(`  Context:       ${formatContextWindow(modelInfo.context_window)} tokens`);
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
          console.log(`  Session ID:    ${tracker.getSessionId()}`);
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
          const session = getSessionData();
          showTodoList(session.todos);
          break;
        }

        case "clear-todos": {
          clearSessionData();
          log.success("Todos cleared.");
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
          log.success("Chat history cleared.");
          break;
        }

        case "api-key": {
          const { key } = await inquirer.prompt([
            {
              type: "password",
              name: "key",
              message: "Enter new API Key:",
              mask: "*",
            },
          ]);
          setApiKey(key.trim());
          apiKey = key.trim();
          modelProvider.initialize(key.trim(), modelConfig.modelId);
          cachedModels = []; // Clear model cache
          log.success("API Key updated.");
          break;
        }

        case "settings": {
          console.log("\n┌─────────────────────────────────────┐");
          console.log("│         CUSTOMIZATION               │");
          console.log("└─────────────────────────────────────┘\n");

          const currentCustomization = getCustomization();
          console.log(
            chalk.gray(`  Current CLI Name: ${chalk.cyan(currentCustomization.cliName)}`)
          );
          console.log(
            chalk.gray(
              `  Current User: ${chalk.cyan(currentCustomization.userName || "(not set)")}`
            )
          );
          console.log(chalk.gray(`  Current Theme: ${chalk.cyan(currentCustomization.theme)}`));
          console.log("");

          try {
            const settingChoice = await select({
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
              const { newName } = await inquirer.prompt([
                {
                  type: "input",
                  name: "newName",
                  message: "Enter new CLI name (e.g., 'My CLI', 'Dev Tool'):",
                  default: currentCustomization.cliName,
                },
              ]);
              if (newName && newName.trim()) {
                setCliName(newName.trim());
                log.success(`CLI name changed to: ${newName.trim()}`);
                log.info("Restart the CLI to see the new banner.");
              }
            } else if (settingChoice === "user-name") {
              const { newUserName } = await inquirer.prompt([
                {
                  type: "input",
                  name: "newUserName",
                  message: "Enter your name (for greeting):",
                  default: currentCustomization.userName || "",
                },
              ]);
              if (newUserName && newUserName.trim()) {
                setUserName(newUserName.trim());
                log.success(`Welcome message will now greet: ${newUserName.trim()}`);
              }
            } else if (settingChoice === "theme") {
              const themeChoice = await select({
                message: "Select a theme:",
                choices: [
                  { name: "Default (Cyan)", value: "default" },
                  { name: "Minimal (White)", value: "minimal" },
                  { name: "Colorful (Magenta)", value: "colorful" },
                ],
              });
              setTheme(themeChoice as "default" | "minimal" | "colorful");
              log.success(`Theme changed to: ${themeChoice}`);
              log.info("Restart the CLI to see the new theme.");
            } else if (settingChoice === "reset") {
              resetCustomization();
              log.success("Customization reset to defaults.");
            }
          } catch {
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
      console.log(chalk.yellow("┌─────────────────────────────────────────────────────┐"));
      console.log(
        chalk.yellow("│") +
          chalk.red.bold("  Model Error Detected                               ") +
          chalk.yellow("│")
      );
      console.log(chalk.yellow("└─────────────────────────────────────────────────────┘"));

      const errorMessages: Record<string, string> = {
        rate_limit: "Rate limit exceeded. The model is receiving too many requests.",
        model_unavailable: "Model is currently unavailable or overloaded.",
        auth_error: "Authentication error. Please check your API key.",
        unknown: "An error occurred with the current model.",
      };

      console.log(chalk.dim(`  ${errorMessages[result.errorType || "unknown"]}`));
      console.log("");
      console.log(chalk.cyan("  Would you like to switch to a different model?"));
      console.log("");

      // Fetch models if not cached
      if (cachedModels.length === 0) {
        const spinner = ora("Fetching available models...").start();
        cachedModels = await fetchGroqModels(apiKey);
        spinner.succeed(`Found ${cachedModels.length} models`);
      }

      // Filter out the current model and build choices
      const currentModel = modelProvider.modelId;
      const availableModels = cachedModels.filter((m) => m.id !== currentModel);
      const grouped = groupModelsByOwner(availableModels);
      const modelChoices: Array<{ name: string; value: string } | Separator> = [];

      // Add "Cancel" option first
      modelChoices.push({
        name: chalk.dim("  Cancel (keep current model)"),
        value: "__cancel__",
      });
      modelChoices.push(new Separator("─── Available Models ───"));

      for (const [owner, models] of grouped) {
        modelChoices.push(new Separator(`─── ${owner} ───`));
        for (const model of models) {
          const ctx = formatContextWindow(model.context_window);
          modelChoices.push({
            name: `  ${model.id} (${ctx} ctx)`,
            value: model.id,
          });
        }
      }

      try {
        const selectedModel = await select({
          message: "Select a model to switch to:",
          choices: modelChoices,
          pageSize: 12,
          loop: false,
        });

        if (selectedModel && selectedModel !== "__cancel__") {
          const oldModel = currentModel;
          setActiveModel(selectedModel);
          modelProvider.setModel(selectedModel);
          chatHandler.updateModelProvider(modelProvider);
          log.success(`Switched to model: ${selectedModel}`);
          tracker.modelSwitch(oldModel, selectedModel, true);

          // Ask if user wants to retry the last message
          console.log("");
          const { retry } = await inquirer.prompt([
            {
              type: "confirm",
              name: "retry",
              message: "Retry your last message with the new model?",
              default: true,
            },
          ]);

          if (retry) {
            console.log(chalk.dim("Retrying with new model..."));
            await chatHandler.processUserInput(userInput);
          }
        } else {
          log.info("Keeping current model. You can try again or switch models with /model");
        }
      } catch {
        // User cancelled with Ctrl+C
        log.info("Model switch cancelled.");
      }
    }
  }
});

program.parse(process.argv);
