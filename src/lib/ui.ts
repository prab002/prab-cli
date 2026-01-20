import chalk from "chalk";
import { TodoItem } from "../types";
import { diffLines } from "diff";

// Syntax highlighting color schemes for different languages
const syntaxColors = {
  keyword: chalk.magenta,
  string: chalk.green,
  number: chalk.yellow,
  comment: chalk.gray,
  function: chalk.cyan,
  variable: chalk.white,
  operator: chalk.yellow,
  punctuation: chalk.white,
  type: chalk.blue,
};

// Common keywords for different languages
const keywords = new Set([
  // JavaScript/TypeScript
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  "class",
  "extends",
  "new",
  "this",
  "super",
  "import",
  "export",
  "from",
  "as",
  "default",
  "async",
  "await",
  "yield",
  "typeof",
  "instanceof",
  "in",
  "of",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "delete",
  "static",
  "get",
  "set",
  "interface",
  "type",
  "enum",
  "implements",
  "private",
  "public",
  "protected",
  // Python
  "def",
  "class",
  "import",
  "from",
  "as",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "try",
  "except",
  "finally",
  "raise",
  "with",
  "lambda",
  "return",
  "yield",
  "True",
  "False",
  "None",
  "and",
  "or",
  "not",
  "is",
  "in",
  "pass",
  "global",
  "nonlocal",
  "assert",
  "break",
  "continue",
  "self",
  "async",
  "await",
  // Go
  "func",
  "package",
  "import",
  "type",
  "struct",
  "interface",
  "map",
  "chan",
  "go",
  "defer",
  "select",
  "range",
  "make",
  "append",
  "len",
  "cap",
  "nil",
  // Rust
  "fn",
  "let",
  "mut",
  "pub",
  "mod",
  "use",
  "struct",
  "enum",
  "impl",
  "trait",
  "match",
  "loop",
  "move",
  "ref",
  "self",
  "Self",
  "where",
  "unsafe",
  "async",
  // Common
  "print",
  "println",
  "printf",
  "console",
  "log",
  "error",
  "warn",
]);

/**
 * Truncate output for brief display
 */
const truncateOutput = (text: string, maxLen: number): string => {
  const firstLine = text.split("\n")[0];
  if (firstLine.length > maxLen) {
    return firstLine.substring(0, maxLen) + "...";
  }
  return firstLine;
};

/**
 * Format diff output with colors
 */
const formatDiffOutput = (output: string): string => {
  const lines = output.split("\n");
  return lines
    .map((line) => {
      // File headers
      if (line.startsWith("diff --git")) {
        return chalk.bold.white(line);
      }
      if (line.startsWith("index ")) {
        return chalk.gray(line);
      }
      if (line.startsWith("---")) {
        return chalk.red.bold(line);
      }
      if (line.startsWith("+++")) {
        return chalk.green.bold(line);
      }
      // Hunk headers
      if (line.startsWith("@@")) {
        return chalk.cyan(line);
      }
      // Added lines
      if (line.startsWith("+")) {
        return chalk.green(line);
      }
      // Removed lines
      if (line.startsWith("-")) {
        return chalk.red(line);
      }
      // Context lines
      return chalk.gray(line);
    })
    .join("\n");
};

/**
 * Format git log output with colors
 */
const formatGitLogOutput = (output: string): string => {
  const lines = output.split("\n");
  return lines
    .map((line) => {
      // Commit hash
      if (line.match(/^[a-f0-9]{7,40}\s/)) {
        const parts = line.split(" ");
        const hash = parts[0];
        const rest = parts.slice(1).join(" ");
        return chalk.yellow(hash) + " " + rest;
      }
      // Date lines
      if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
        return chalk.blue(line);
      }
      // Author
      if (line.toLowerCase().includes("author:")) {
        return chalk.cyan(line);
      }
      // Commit message (indented)
      if (line.startsWith("  ")) {
        return chalk.white(line);
      }
      return line;
    })
    .join("\n");
};

/**
 * Format git status output with colors
 */
const formatGitStatusOutput = (output: string): string => {
  const lines = output.split("\n");
  return lines
    .map((line) => {
      // Branch info
      if (line.startsWith("On branch") || line.startsWith("HEAD detached")) {
        return chalk.cyan.bold(line);
      }
      // Modified files
      if (line.includes("modified:")) {
        return chalk.yellow(line);
      }
      // New files
      if (line.includes("new file:")) {
        return chalk.green(line);
      }
      // Deleted files
      if (line.includes("deleted:")) {
        return chalk.red(line);
      }
      // Untracked files header
      if (line.includes("Untracked files:")) {
        return chalk.magenta.bold(line);
      }
      // Staged changes header
      if (line.includes("Changes to be committed:")) {
        return chalk.green.bold(line);
      }
      // Unstaged changes header
      if (line.includes("Changes not staged")) {
        return chalk.yellow.bold(line);
      }
      // File status indicators (M, A, D, ??)
      if (line.match(/^\s*[MADRCU?]{1,2}\s+/)) {
        const status = line.match(/^\s*([MADRCU?]{1,2})\s+(.*)$/);
        if (status) {
          const indicator = status[1];
          const filename = status[2];
          let color = chalk.white;
          if (indicator.includes("M")) color = chalk.yellow;
          if (indicator.includes("A")) color = chalk.green;
          if (indicator.includes("D")) color = chalk.red;
          if (indicator.includes("?")) color = chalk.gray;
          return color(`  ${indicator} ${filename}`);
        }
      }
      return chalk.gray(line);
    })
    .join("\n");
};

/**
 * Apply syntax highlighting to a line of code
 */
const highlightCodeLine = (line: string): string => {
  // Handle comments
  const commentMatch = line.match(/^(\s*)(\/\/.*|#.*|\/\*.*\*\/|<!--.*-->)$/);
  if (commentMatch) {
    return commentMatch[1] + syntaxColors.comment(commentMatch[2]);
  }

  let result = line;

  // Highlight strings (single, double, template)
  result = result.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, (match) => syntaxColors.string(match));

  // Highlight numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, (match) => syntaxColors.number(match));

  // Highlight keywords
  const words = result.split(/(\s+|[^\w])/);
  result = words
    .map((word) => {
      if (keywords.has(word)) {
        return syntaxColors.keyword(word);
      }
      return word;
    })
    .join("");

  // Highlight function calls
  result = result.replace(
    /\b([a-zA-Z_]\w*)\s*\(/g,
    (match, name) => syntaxColors.function(name) + "("
  );

  return result;
};

/**
 * Format file content with line numbers and syntax highlighting
 */
const formatFileContent = (content: string, _filename?: string): string => {
  const lines = content.split("\n");
  const lineNumWidth = String(lines.length).length;

  return lines
    .map((line, idx) => {
      const lineNum = String(idx + 1).padStart(lineNumWidth, " ");
      const highlighted = highlightCodeLine(line);
      return chalk.gray(`${lineNum} │ `) + highlighted;
    })
    .join("\n");
};

/**
 * Format bash command output
 */
const formatBashOutput = (output: string): string => {
  // Check if it looks like a diff
  if (
    output.includes("diff --git") ||
    (output.includes("@@") && (output.includes("+") || output.includes("-")))
  ) {
    return formatDiffOutput(output);
  }

  // Check if it looks like git log
  if (output.match(/^[a-f0-9]{7,40}\s+\d{4}-\d{2}-\d{2}/m)) {
    return formatGitLogOutput(output);
  }

  // Generic output with some highlighting
  const lines = output.split("\n");
  return lines
    .map((line) => {
      // Error messages
      if (line.toLowerCase().includes("error") || line.toLowerCase().includes("failed")) {
        return chalk.red(line);
      }
      // Warning messages
      if (line.toLowerCase().includes("warning") || line.toLowerCase().includes("warn")) {
        return chalk.yellow(line);
      }
      // Success messages
      if (
        line.toLowerCase().includes("success") ||
        line.toLowerCase().includes("done") ||
        line.toLowerCase().includes("passed")
      ) {
        return chalk.green(line);
      }
      // Paths
      if (line.match(/^[./~]/)) {
        return chalk.cyan(line);
      }
      return line;
    })
    .join("\n");
};

/**
 * Format tool output based on tool type
 */
const formatToolOutput = (toolName: string, output: string): string => {
  if (!output || output.trim() === "") {
    return chalk.gray("  (no output)");
  }

  let formatted: string;

  switch (toolName.toLowerCase()) {
    case "git_diff":
    case "gitdiff":
      formatted = formatDiffOutput(output);
      break;
    case "git_log":
    case "gitlog":
      formatted = formatGitLogOutput(output);
      break;
    case "git_status":
    case "gitstatus":
      formatted = formatGitStatusOutput(output);
      break;
    case "read_file":
    case "readfile":
      formatted = formatFileContent(output);
      break;
    case "bash":
    case "shell":
      formatted = formatBashOutput(output);
      break;
    case "glob":
    case "grep":
      // File lists - highlight paths
      formatted = output
        .split("\n")
        .map((line) => {
          if (line.includes(":")) {
            const [path, ...rest] = line.split(":");
            return chalk.cyan(path) + ":" + chalk.white(rest.join(":"));
          }
          return chalk.cyan(line);
        })
        .join("\n");
      break;
    default:
      formatted = output;
  }

  return `\n${chalk.gray("Output:")}\n${formatted}`;
};

export const log = {
  info: (msg: string) => console.log(chalk.blue("ℹ"), msg),
  success: (msg: string) => console.log(chalk.green("✔"), msg),
  warning: (msg: string) => console.log(chalk.yellow("⚠"), msg),
  error: (msg: string) => console.log(chalk.red("✖"), msg),
  code: (msg: string) => console.log(chalk.gray(msg)),

  // Tool feedback methods
  tool: (name: string, action: string) => {
    console.log(chalk.cyan("🔧"), `Tool: ${chalk.bold(name)} - ${action}`);
  },

  toolResult: (success: boolean, message: string) => {
    if (success) {
      console.log(chalk.green("  ✓"), chalk.gray(truncateOutput(message, 100)));
    } else {
      console.log(chalk.red("  ✗"), chalk.gray(message));
    }
  },

  // Display formatted tool output
  toolOutput: (toolName: string, output: string) => {
    const formatted = formatToolOutput(toolName, output);
    console.log(formatted);
  },
};

export const banner = (modelName?: string, toolCount?: number) => {
  console.log(
    chalk.bold.cyan(`
   ____             __      ________    ____
   / __ \\_________ _/ /_    / ____/ /   /  _/
  / /_/ / ___/ __ \`/ __ \\  / /   / /    / /
 / ____/ /  / /_/ / /_/ / / /___/ /____/ /
/_/   /_/   \\__,_/_.___/  \\____/_____/___/
`)
  );

  if (modelName) {
    console.log(chalk.gray(`  Active Model: ${chalk.cyan(modelName)}`));
  }
  if (toolCount !== undefined) {
    console.log(chalk.gray(`  Available Tools: ${chalk.cyan(toolCount.toString())}`));
  }
  console.log("");
};

/**
 * Display a diff between two strings
 */
export const showDiff = (before: string, after: string, filename?: string) => {
  if (filename) {
    console.log(chalk.bold(`\nDiff for ${filename}:`));
  }

  const diff = diffLines(before, after);

  diff.forEach((part) => {
    const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.gray;

    const prefix = part.added ? "+ " : part.removed ? "- " : "  ";

    const lines = part.value.split("\n");
    lines.forEach((line) => {
      if (line) {
        console.log(color(prefix + line));
      }
    });
  });
  console.log("");
};

/**
 * Display todo list
 */
export const showTodoList = (todos: TodoItem[]) => {
  if (todos.length === 0) {
    console.log(chalk.gray("  No todos"));
    return;
  }

  console.log(chalk.bold("\n📋 Todo List:"));

  todos.forEach((todo, _index) => {
    const status =
      todo.status === "completed"
        ? chalk.green("✓")
        : todo.status === "in_progress"
          ? chalk.yellow("⋯")
          : chalk.gray("○");

    const text = todo.status === "in_progress" ? todo.activeForm : todo.content;
    const textColor =
      todo.status === "completed"
        ? chalk.gray
        : todo.status === "in_progress"
          ? chalk.cyan
          : chalk.white;

    console.log(`  ${status} ${textColor(text)}`);
  });
  console.log("");
};

/**
 * Show tool execution progress
 */
export const showToolProgress = (toolName: string, status: "started" | "completed" | "failed") => {
  const icon = status === "started" ? "⏳" : status === "completed" ? "✓" : "✗";

  const color =
    status === "started" ? chalk.yellow : status === "completed" ? chalk.green : chalk.red;

  console.log(color(`${icon} ${toolName} ${status}`));
};

/**
 * Format a code block with syntax highlighting and borders
 */
const formatCodeBlock = (code: string, language: string): string => {
  const lines = code.split("\n");
  const maxLineLen = Math.max(...lines.map((l) => l.length), 40);
  const boxWidth = Math.min(maxLineLen + 4, 80);

  const langLabel = language ? chalk.cyan.bold(` ${language} `) : "";
  const topBorder =
    chalk.gray("╭") +
    langLabel +
    chalk.gray("─".repeat(Math.max(0, boxWidth - language.length - 3))) +
    chalk.gray("╮");
  const bottomBorder = chalk.gray("╰" + "─".repeat(boxWidth - 1) + "╯");

  const formattedLines = lines.map((line) => {
    const highlighted = highlightCodeLine(line);
    return chalk.gray("│ ") + highlighted;
  });

  return ["", topBorder, ...formattedLines, bottomBorder, ""].join("\n");
};

/**
 * Format markdown text with colors for terminal display
 */
export const formatMarkdown = (text: string): string => {
  let result = text;

  // Extract and format code blocks first (to avoid processing their content)
  const codeBlocks: { placeholder: string; formatted: string }[] = [];
  let blockIndex = 0;

  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `__CODE_BLOCK_${blockIndex}__`;
    codeBlocks.push({
      placeholder,
      formatted: formatCodeBlock(code.trimEnd(), lang || ""),
    });
    blockIndex++;
    return placeholder;
  });

  // Format inline code
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    return chalk.bgGray.white(` ${code} `);
  });

  // Format headers
  result = result.replace(/^### (.+)$/gm, (_, text) => {
    return chalk.cyan.bold(`   ${text}`);
  });
  result = result.replace(/^## (.+)$/gm, (_, text) => {
    return chalk.cyan.bold(`  ${text}`);
  });
  result = result.replace(/^# (.+)$/gm, (_, text) => {
    return chalk.cyan.bold.underline(text);
  });

  // Format bold text
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, text) => {
    return chalk.bold(text);
  });

  // Format italic text
  result = result.replace(/\*([^*]+)\*/g, (_, text) => {
    return chalk.italic(text);
  });

  // Format bullet points
  result = result.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, text) => {
    return indent + chalk.yellow("•") + " " + text;
  });

  // Format numbered lists
  result = result.replace(/^(\s*)(\d+)\. (.+)$/gm, (_, indent, num, text) => {
    return indent + chalk.yellow(num + ".") + " " + text;
  });

  // Format blockquotes
  result = result.replace(/^> (.+)$/gm, (_, text) => {
    return chalk.gray("│ ") + chalk.italic.gray(text);
  });

  // Format horizontal rules
  result = result.replace(/^---+$/gm, () => {
    return chalk.gray("─".repeat(50));
  });

  // Restore code blocks
  for (const block of codeBlocks) {
    result = result.replace(block.placeholder, block.formatted);
  }

  return result;
};

/**
 * Stream formatter for real-time markdown rendering
 * Handles partial chunks and code block detection
 */
export class StreamFormatter {
  private buffer: string = "";
  private inCodeBlock: boolean = false;
  private codeBlockLang: string = "";
  private codeBlockContent: string = "";

  /**
   * Process a chunk of streaming text and return formatted output
   */
  processChunk(chunk: string): string {
    this.buffer += chunk;
    let output = "";

    // Process complete lines
    while (this.buffer.includes("\n")) {
      const newlineIndex = this.buffer.indexOf("\n");
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      output += this.processLine(line) + "\n";
    }

    return output;
  }

  /**
   * Flush remaining buffer content
   */
  flush(): string {
    if (this.buffer.length > 0) {
      const remaining = this.processLine(this.buffer);
      this.buffer = "";
      return remaining;
    }
    return "";
  }

  private processLine(line: string): string {
    // Check for code block start
    if (line.startsWith("```") && !this.inCodeBlock) {
      this.inCodeBlock = true;
      this.codeBlockLang = line.slice(3).trim();
      this.codeBlockContent = "";
      return ""; // Don't output yet
    }

    // Check for code block end
    if (line === "```" && this.inCodeBlock) {
      this.inCodeBlock = false;
      const formatted = formatCodeBlock(this.codeBlockContent.trimEnd(), this.codeBlockLang);
      this.codeBlockContent = "";
      this.codeBlockLang = "";
      return formatted;
    }

    // Inside code block - accumulate
    if (this.inCodeBlock) {
      this.codeBlockContent += line + "\n";
      return ""; // Don't output yet
    }

    // Regular line - format it
    return this.formatLine(line);
  }

  private formatLine(line: string): string {
    // Format inline code
    let result = line.replace(/`([^`]+)`/g, (_, code) => {
      return chalk.bgGray.white(` ${code} `);
    });

    // Format headers
    if (result.startsWith("### ")) {
      return chalk.cyan.bold("   " + result.slice(4));
    }
    if (result.startsWith("## ")) {
      return chalk.cyan.bold("  " + result.slice(3));
    }
    if (result.startsWith("# ")) {
      return chalk.cyan.bold.underline(result.slice(2));
    }

    // Format bold
    result = result.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));

    // Format italic
    result = result.replace(/\*([^*]+)\*/g, (_, text) => chalk.italic(text));

    // Format bullets
    if (/^\s*[-*] /.test(result)) {
      result = result.replace(/^(\s*)[-*] /, (_, indent) => indent + chalk.yellow("•") + " ");
    }

    // Format numbered lists
    result = result.replace(
      /^(\s*)(\d+)\. /,
      (_, indent, num) => indent + chalk.yellow(num + ".") + " "
    );

    // Format blockquotes
    if (result.startsWith("> ")) {
      return chalk.gray("│ ") + chalk.italic.gray(result.slice(2));
    }

    // Format horizontal rules
    if (/^---+$/.test(result)) {
      return chalk.gray("─".repeat(50));
    }

    return result;
  }
}
