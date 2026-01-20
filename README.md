# Prab CLI

An AI-powered coding assistant for your terminal. Built with Groq's lightning-fast LLMs, featuring autonomous tool execution, syntax-highlighted output, and seamless git integration.

![Version](https://img.shields.io/npm/v/prab-cli)
![License](https://img.shields.io/npm/l/prab-cli)

## Features

- **AI-Powered Coding Assistant** - Chat with AI that understands your codebase
- **Autonomous Tool Execution** - AI can read, write, and edit files directly
- **Git Integration** - Built-in git status, diff, commit, push, and more
- **Syntax Highlighting** - Beautiful colored output for code blocks and diffs
- **Multiple Models** - Switch between Groq models on the fly
- **Task Tracking** - Built-in todo management for complex tasks
- **Safety Checks** - Confirmation prompts for destructive operations
- **Session Logging** - Debug and track all AI interactions

## Installation

```bash
npm install -g prab-cli
```

## Quick Start

1. **Get a Groq API Key** from [console.groq.com](https://console.groq.com)

2. **Configure your API key:**
```bash
groq-cli config
```

3. **Start chatting:**
```bash
groq-cli
```

## Usage

### Interactive Mode

Simply run `groq-cli` to start an interactive session:

```bash
groq-cli
```

You'll see the welcome banner and can start chatting with the AI:

```
   ____             __      ________    ____
   / __ \_________ _/ /_    / ____/ /   /  _/
  / /_/ / ___/ __ `/ __ \  / /   / /    / /
 / ____/ /  / /_/ / /_/ / / /___/ /____/ /
/_/   /_/   \__,_/_.___/  \____/_____/___/

  Active Model: llama-3.3-70b-versatile
  Available Tools: 14

> Help me refactor the authentication module
```

### Slash Commands

Type `/` during a session to access the command menu:

| Command | Description |
|---------|-------------|
| `/` | Open command menu |
| `/exit` | Exit the CLI |
| `/clear` | Clear chat history |
| `/context` | Show loaded file context |
| `/tools` | List available tools |
| `/todos` | Show current todo list |

### Command Menu Options

1. **Select Model** - Switch between available Groq models
2. **Usage** - View current model and session stats
3. **Tools** - List all available tools
4. **Todos** - View task list
5. **Clear Todos** - Reset task list
6. **Context** - Show file context
7. **Clear History** - Reset conversation
8. **API Key** - Update your API key
9. **Exit** - Quit the CLI

## Available Tools

The AI has access to these tools for autonomous coding:

### File Operations
| Tool | Description |
|------|-------------|
| `read_file` | Read file contents with line numbers |
| `write_file` | Create or overwrite files |
| `edit_file` | Make targeted edits to existing files |
| `glob` | Find files matching patterns |
| `grep` | Search file contents with regex |

### Git Operations
| Tool | Description |
|------|-------------|
| `git_status` | Show working tree status |
| `git_diff` | Show changes between commits |
| `git_log` | View commit history |
| `git_add` | Stage files for commit |
| `git_commit` | Create a commit |
| `git_branch` | List or create branches |
| `git_push` | Push commits to remote |

### System
| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands |
| `manage_todos` | Track tasks and progress |

## Colorized Output

The CLI provides rich, colorized output for better readability:

### Git Diff
- Added lines in **green**
- Removed lines in **red**
- Hunk headers in **cyan**
- File headers in **bold**

### Code Blocks
- Keywords highlighted in **magenta**
- Strings in **green**
- Numbers in **yellow**
- Comments in **gray**
- Function calls in **cyan**

### Markdown
- Headers in **cyan bold**
- Inline code with **gray background**
- Bullet points with **yellow** markers
- Bold and italic text styling

## Configuration

### API Key

Set your Groq API key:

```bash
# Interactive prompt
groq-cli config

# Or directly
groq-cli config YOUR_API_KEY
```

### Reset API Key

```bash
groq-cli reset
```

### Model Management

```bash
groq-cli model
```

Options:
- List available models
- Show current model
- Switch to a different model

## Supported Models

The CLI supports all Groq models including:

- `llama-3.3-70b-versatile` (default)
- `llama-3.1-70b-versatile`
- `llama-3.1-8b-instant`
- `mixtral-8x7b-32768`
- `gemma2-9b-it`
- And more...

Models are fetched dynamically from the Groq API.

## Session Logging

Debug logs are stored in `~/.prab-cli/logs/`. View them with:

```bash
# View latest log
npm run log

# List all logs
npm run log:list
```

## Examples

### Read and Edit a File

```
> Read the package.json and update the version to 2.0.0
```

The AI will:
1. Use `read_file` to view package.json
2. Use `edit_file` to update the version
3. Show you the diff of changes

### Git Workflow

```
> Check the git status and commit all changes with a descriptive message
```

The AI will:
1. Run `git_status` to see changes
2. Use `git_add` to stage files
3. Create a commit with `git_commit`

### Code Search

```
> Find all files that import the 'express' module
```

The AI will use `grep` to search for import statements.

## Safety Features

- **Confirmation Prompts** - Destructive operations require approval
- **Session Memory** - Remember choices for similar operations
- **Read-Only by Default** - Tools like `read_file` and `git_status` run without confirmation

## Requirements

- Node.js 18+
- npm or yarn
- Groq API key

## Development

```bash
# Clone the repo
git clone https://github.com/prab002/prab-cli.git
cd prab-cli

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run production build
npm start
```

## License

ISC

## Author

Prabhanjan Sharma

---

Built with [Groq](https://groq.com) | [LangChain](https://langchain.com) | [Chalk](https://github.com/chalk/chalk)
