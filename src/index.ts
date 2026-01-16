#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import { getApiKey, setApiKey, clearApiKey, getModelConfig, setActiveModel, getPreferences, clearSessionData } from './lib/config';
import { isGitRepo, getFileTree } from './lib/context';
import { log, banner, showTodoList } from './lib/ui';
import { getSessionData } from './lib/config';
import ora from 'ora';

// Import tool system
import { ToolRegistry } from './lib/tools/base';
import { ToolExecutor } from './lib/tools/executor';
import { ReadFileTool, WriteFileTool, EditFileTool, GlobTool, GrepTool } from './lib/tools/file-tools';
import { BashTool } from './lib/tools/shell-tools';
import { GitStatusTool, GitAddTool, GitDiffTool, GitLogTool, GitCommitTool, GitBranchTool, GitPushTool } from './lib/tools/git-tools';
import { TodoTool } from './lib/tools/todo-tool';

// Import model system
import { GroqProvider } from './lib/models/groq-provider';
import { getModelList, isValidModel, validateModelId } from './lib/models/registry';

// Import chat handler and safety
import { ChatHandler } from './lib/chat-handler';
import { SafetyChecker } from './lib/safety';
import { tracker } from './lib/tracker';

const program = new Command();

program
  .name('groq-cli')
  .description('An AI coding assistant with autonomous tool capabilities')
  .version('2.0.0');

// Config command
program
  .command('config [key]')
  .description('Set your Groq API Key')
  .action(async (key?: string) => {
    if (key) {
        setApiKey(key.trim());
        log.success('API Key saved successfully!');
        return;
    }
    const { inputKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'inputKey',
        message: 'Enter your Groq API Key:',
        mask: '*',
      },
    ]);
    setApiKey(inputKey.trim());
    log.success('API Key saved successfully!');
  });

// Reset command
program
  .command('reset')
  .description('Clear your stored API Key')
  .action(() => {
    clearApiKey();
    log.success('API Key cleared!');
  });

// Model management commands
program
  .command('model')
  .description('Manage AI models')
  .action(async () => {
    const { action } = await inquirer.prompt([
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
      console.log(getModelList());
    } else if (action === 'current') {
      const config = getModelConfig();
      log.info(`Current model: ${config.modelId}`);
      log.info(`Temperature: ${config.temperature}`);
    } else if (action === 'switch') {
      const { modelId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'modelId',
          message: 'Enter model ID:'
        }
      ]);

      const validation = validateModelId(modelId);
      if (validation.valid) {
        setActiveModel(modelId);
        log.success(`Switched to model: ${modelId}`);
      } else {
        log.error(validation.error || 'Invalid model');
        if (validation.suggested) {
          log.info(`Did you mean: ${validation.suggested}?`);
        }
      }
    }
  });

// Main interactive mode
program
  .action(async () => {
    // Check API Key
    let apiKey = getApiKey();
    if (!apiKey) {
      log.warning('No API Key found.');
      const { key } = await inquirer.prompt([
        {
          type: 'password',
          name: 'key',
          message: 'Please enter your Groq API Key to get started:',
          mask: '*',
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
      tracker.modelInit(modelConfig.modelId, 'groq', true);
      tracker.sessionStart(modelConfig.modelId, toolRegistry.count());
    } catch (e: any) {
      log.error('Failed to initialize model.');
      tracker.modelInit(modelConfig.modelId, 'groq', false, e.message);
      process.exit(1);
    }

    // Display banner
    banner(modelConfig.modelId, toolRegistry.count());

    // Context Gathering
    const spinner = ora('Checking context...').start();
    const isRepo = await isGitRepo();
    let contextMessage = '';

    if (isRepo) {
        spinner.text = 'Git repository detected. Gathering file structure...';
        const files = await getFileTree();
        contextMessage = `\n\nCurrent Working Directory Context:\nFile List:\n${files.join('\n')}`;
        spinner.succeed(`Context loaded (${files.length} files detected).`);
    } else {
        spinner.succeed('No Git repository detected. Running in standalone mode.');
    }

    // Initialize chat handler
    const chatHandler = new ChatHandler(toolRegistry, toolExecutor, modelProvider, contextMessage);

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
          type: 'input',
          name: 'userInput',
          message: '>',
        },
      ]);

      // Handle Slash Commands Menu
      if (userInput.trim() === '/') {
        const { action } = await inquirer.prompt([
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
          const session = getSessionData();
          showTodoList(session.todos);
          continue;
        }

        if (action === 'clear_todos') {
          clearSessionData();
          log.success('Todos cleared.');
          continue;
        }

        if (action === 'context') {
            log.info(contextMessage || 'No context loaded.');
            continue;
        }

        if (action === 'clear') {
            chatHandler.clearHistory();
            log.success('Chat history cleared.');
            continue;
        }

        if (action === 'model') {
          console.log('\nAvailable Models:\n');
          console.log(getModelList());
          console.log('');

          const { newModel } = await inquirer.prompt([
            {
              type: 'input',
              name: 'newModel',
              message: 'Enter model ID (or press enter to cancel):'
            }
          ]);

          if (newModel.trim()) {
            const oldModel = modelConfig.modelId;
            const validation = validateModelId(newModel.trim());
            if (validation.valid) {
              setActiveModel(newModel.trim());
              modelProvider.setModel(newModel.trim());
              log.success(`Switched to model: ${newModel.trim()}`);
              tracker.modelSwitch(oldModel, newModel.trim(), true);
            } else {
              log.error(validation.error || 'Invalid model');
              tracker.modelSwitch(oldModel, newModel.trim(), false);
              if (validation.suggested) {
                log.info(`Did you mean: ${validation.suggested}?`);
              }
            }
          }
          continue;
        }

        if (action === 'prefs') {
          const prefs = getPreferences();
          console.log('\n⚙️  Current Preferences:\n');
          console.log(`  Temperature: ${prefs.temperature}`);
          console.log(`  Auto-Confirm: ${prefs.autoConfirm}`);
          console.log(`  Safe Mode: ${prefs.safeMode}`);
          console.log('');
          continue;
        }

        if (action === 'config') {
             const { key } = await inquirer.prompt([{
               type: 'password',
               name: 'key',
               message: 'Enter new API Key:',
               mask: '*'
             }]);
             setApiKey(key.trim());
             modelProvider.initialize(key.trim(), modelConfig.modelId);
             log.success('API Key updated.');
             continue;
        }

        if (action === 'exit') process.exit(0);
        if (action === 'cancel') continue;
      }

      // Handle direct slash commands
      if (userInput.startsWith('/')) {
        const cmd = userInput.trim().toLowerCase();
        if (cmd === '/exit' || cmd === '/quit') process.exit(0);
        if (cmd === '/clear') {
            chatHandler.clearHistory();
            log.success('History cleared.');
            continue;
        }
        if (cmd === '/context') {
            log.info(contextMessage || 'No context.');
            continue;
        }
        if (cmd === '/tools') {
          console.log('\n📦 Available Tools:\n');
          console.log(toolRegistry.getToolDescriptions());
          console.log('');
          continue;
        }
        if (cmd === '/todos') {
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
