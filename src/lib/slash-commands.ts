import search from "@inquirer/search";
import chalk from "chalk";

export interface SlashCommand {
  name: string;
  description: string;
  shortcut?: string;
  action: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/model",
    description: "Switch between available AI models",
    shortcut: "m",
    action: "model",
  },
  {
    name: "/usage",
    description: "Show model info and session statistics",
    shortcut: "u",
    action: "usage",
  },
  {
    name: "/tools",
    description: "List all available tools",
    shortcut: "t",
    action: "tools",
  },
  {
    name: "/todos",
    description: "Display current todo list",
    action: "todos",
  },
  {
    name: "/clear-todos",
    description: "Clear all todos",
    action: "clear-todos",
  },
  {
    name: "/context",
    description: "Show file context from current directory",
    shortcut: "c",
    action: "context",
  },
  {
    name: "/clear",
    description: "Clear chat history",
    action: "clear",
  },
  {
    name: "/api-key",
    description: "Update your Groq API key",
    action: "api-key",
  },
  {
    name: "/settings",
    description: "Customize CLI name, theme, and preferences",
    shortcut: "s",
    action: "settings",
  },
  {
    name: "/exit",
    description: "Exit the application",
    shortcut: "q",
    action: "exit",
  },
];

function formatCommandChoice(cmd: SlashCommand): string {
  const shortcut = cmd.shortcut ? chalk.dim(` (${cmd.shortcut})`) : "";
  return `${chalk.cyan(cmd.name)}${shortcut}  ${chalk.dim("─")}  ${cmd.description}`;
}

export async function showSlashCommandMenu(): Promise<string | null> {
  try {
    const answer = await search({
      message: "Command",
      source: async (input: string | undefined) => {
        const searchTerm = (input || "").toLowerCase().replace(/^\//, "");

        return SLASH_COMMANDS.filter((cmd) => {
          if (!searchTerm) return true;
          return (
            cmd.name.toLowerCase().includes(searchTerm) ||
            cmd.description.toLowerCase().includes(searchTerm) ||
            cmd.shortcut?.toLowerCase() === searchTerm
          );
        }).map((cmd) => ({
          name: formatCommandChoice(cmd),
          value: cmd.action,
          description: cmd.description,
        }));
      },
    });
    return answer;
  } catch (error: any) {
    // User cancelled (Ctrl+C)
    if (error.message?.includes("cancelled") || error.name === "ExitPromptError") {
      return null;
    }
    throw error;
  }
}
