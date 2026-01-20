#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getModelConfig,
  setActiveModel,
  getPreferences,
  clearSessionData,
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

// Import model system
import { GroqProvider } from "./lib/models/groq-provider";
import {
  getModelList,
  isValidModel,
  validateModelId,
  getAllModelIds,
  getModelInfo,
} from "./lib/models/registry";
import {
  fetchGroqModels,
  groupModelsByOwner,
  formatContextWindow,
  GroqModel,
} from "./lib/groq-models";

// Import chat handler and safety
import { ChatHandler, ProcessResult } from "./lib/chat-handler";
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

  // Display banner
  banner(modelConfig.modelId, toolRegistry.count());

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
          } catch (e) {
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
      } catch (e) {
        // User cancelled with Ctrl+C
        log.info("Model switch cancelled.");
      }
    }
  }
});

program.parse(process.argv);
