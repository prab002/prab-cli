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
import { ChatHandler } from "./lib/chat-handler";
import { SafetyChecker } from "./lib/safety";
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
  const modelProvider = new GroqProvider(
    modelConfig.modelId,
    modelConfig.temperature
  );
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
    contextMessage = `\n\nCurrent Working Directory Context:\nFile List:\n${files.join(
      "\n"
    )}`;
    spinner.succeed(`Context loaded (${files.length} files detected).`);
  } else {
    spinner.succeed("No Git repository detected. Running in standalone mode.");
  }

  // Initialize chat handler
  const chatHandler = new ChatHandler(
    toolRegistry,
    toolExecutor,
    modelProvider,
    contextMessage
  );

  log.info('Type "/" for commands menu, or start chatting!');

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

    // Handle Slash Commands Menu
    if (userInput.trim() === "/") {
      const currentModel = modelProvider.modelId;

      console.log("\n┌────────────────────────────────────────┐");
      console.log("│           AVAILABLE COMMANDS           │");
      console.log("└────────────────────────────────────────┘\n");

      const { action } = await inquirer.prompt([
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
          const spinner = ora("Fetching available models from Groq...").start();
          cachedModels = await fetchGroqModels(apiKey);
          spinner.succeed(`Found ${cachedModels.length} models`);
        }

        // Group models by owner
        const grouped = groupModelsByOwner(cachedModels);
        const modelChoices: any[] = [];

        // Build choices grouped by owner
        for (const [owner, models] of grouped) {
          modelChoices.push(new inquirer.Separator(`─── ${owner} ───`));
          for (const model of models) {
            const isCurrent = model.id === currentModel;
            const ctx = formatContextWindow(model.context_window);
            modelChoices.push({
              name: `${isCurrent ? "✓ " : "  "}${model.id} (${ctx} ctx)`,
              value: model.id,
              short: model.id,
            });
          }
        }

        const { selectedModel } = await inquirer.prompt([
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
          setActiveModel(selectedModel);
          modelProvider.setModel(selectedModel);
          log.success(`Switched to model: ${selectedModel}`);
          tracker.modelSwitch(oldModel, selectedModel, true);
        } else if (selectedModel === currentModel) {
          log.info(`Already using ${selectedModel}`);
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
        console.log("│          SESSION STATS              │");
        console.log("└─────────────────────────────────────┘\n");

        console.log(`  Messages:      ${chatHandler.getMessageCount()}`);
        console.log(`  Tools:         ${toolRegistry.count()} available`);
        console.log(`  Session ID:    ${tracker.getSessionId()}`);
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
        const session = getSessionData();
        showTodoList(session.todos);
        continue;
      }

      if (action === "5. Clear Todos") {
        clearSessionData();
        log.success("Todos cleared.");
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
        log.success("Chat history cleared.");
        continue;
      }

      if (action === "8. API Key") {
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
        continue;
      }

      if (action === "9. Exit") process.exit(0);
      continue;
    }

    // Handle direct slash commands
    if (userInput.startsWith("/")) {
      const cmd = userInput.trim().toLowerCase();
      if (cmd === "/exit" || cmd === "/quit") process.exit(0);
      if (cmd === "/clear") {
        chatHandler.clearHistory();
        log.success("History cleared.");
        continue;
      }
      if (cmd === "/context") {
        log.info(contextMessage || "No context.");
        continue;
      }
      if (cmd === "/tools") {
        console.log("\n📦 Available Tools:\n");
        console.log(toolRegistry.getToolDescriptions());
        console.log("");
        continue;
      }
      if (cmd === "/todos") {
        const session = getSessionData();
        showTodoList(session.todos);
        continue;
      }
      log.warning(`Unknown command: ${cmd}. Type "/" for menu.`);
      continue;
    }

    // Process user input with chat handler
    await chatHandler.processUserInput(userInput);
  }
});

program.parse(process.argv);
