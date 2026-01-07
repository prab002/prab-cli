#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import { getApiKey, setApiKey, clearApiKey } from './lib/config';
import { streamChat, initGroq, Message } from './lib/groq';
import { isGitRepo, getFileTree, getFileContent } from './lib/context';
import { log, banner } from './lib/ui';
import ora from 'ora';

const program = new Command();

program
  .name('groq-cli')
  .description('A fast AI coding assistant powered by Groq')
  .version('1.0.0');

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

program
  .command('reset')
  .description('Clear your stored API Key')
  .action(() => {
    clearApiKey();
    log.success('API Key cleared!');
  });

program
  .action(async () => {
    banner();

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

    try {
        initGroq();
    } catch (e) {
        log.error('Failed to initialize Groq client.');
        process.exit(1);
    }

    // Context Gathering
    const spinner = ora('Checking context...').start();
    const isRepo = await isGitRepo();
    let contextMessage = '';
    
    if (isRepo) {
        spinner.text = 'Git repository detected. Gathering file structure...';
        const files = await getFileTree();
        // Limit context to file names for now to save tokens, read content only if asked?
        // For a simple CLI, let's just dump the file tree as context.
        contextMessage = `\n\nCurrent Working Directory Context:\nFile List:\n${files.join('\n')}`;
        spinner.succeed(`Context loaded (${files.length} files detected).`);
    } else {
        spinner.succeed('No Git repository detected. Running in standalone mode.');
    }

    const messages: Message[] = [
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
      const { userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInput',
          message: '>',
        },
      ]);

      // Handle Slash Commands
      if (userInput.trim() === '/') {
        const { action } = await inquirer.prompt([
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
            log.info(contextMessage || 'No context loaded.');
            continue;
        }
        if (action === 'clear') {
            messages.length = 1; // Keep system prompt
            log.success('Chat history cleared.');
            continue;
        }
        if (action === 'config') {
             const { key } = await inquirer.prompt([{ type: 'password', name: 'key', message: 'Enter new API Key:', mask: '*' }]);
             setApiKey(key.trim());
             initGroq();
             log.success('API Key updated.');
             continue;
        }
        if (action === 'exit') process.exit(0);
        if (action === 'cancel') continue;
      }

      if (userInput.startsWith('/')) {
        const cmd = userInput.trim().toLowerCase();
        if (cmd === '/exit' || cmd === '/quit') process.exit(0);
        if (cmd === '/clear') {
            messages.length = 1; 
            log.success('History cleared.'); 
            continue;
        }
        if (cmd === '/context') {
            log.info(contextMessage || 'No context.');
            continue;
        }
        log.warning(`Unknown command: ${cmd}`);
        continue;
      }

      messages.push({ role: 'user', content: userInput });

      try {
        const stream = await streamChat(messages);
        let assistantResponse = '';
        
        process.stdout.write('\n'); // Newline before response

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            process.stdout.write(content);
            assistantResponse += content;
        }

        process.stdout.write('\n\n'); // Newline after response
        messages.push({ role: 'assistant', content: assistantResponse });

      } catch (error: any) {
        log.error(`Error: ${error.message}`);
      }
    }
  });

program.parse(process.argv);
