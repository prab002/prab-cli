"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLASH_COMMANDS = void 0;
exports.showSlashCommandMenu = showSlashCommandMenu;
const search_1 = __importDefault(require("@inquirer/search"));
const chalk_1 = __importDefault(require("chalk"));
exports.SLASH_COMMANDS = [
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
        name: "/exit",
        description: "Exit the application",
        shortcut: "q",
        action: "exit",
    },
];
function formatCommandChoice(cmd) {
    const shortcut = cmd.shortcut ? chalk_1.default.dim(` (${cmd.shortcut})`) : "";
    return `${chalk_1.default.cyan(cmd.name)}${shortcut}  ${chalk_1.default.dim("─")}  ${cmd.description}`;
}
async function showSlashCommandMenu() {
    try {
        const answer = await (0, search_1.default)({
            message: "Command",
            source: async (input) => {
                const searchTerm = (input || "").toLowerCase().replace(/^\//, "");
                return exports.SLASH_COMMANDS.filter((cmd) => {
                    if (!searchTerm)
                        return true;
                    return (cmd.name.toLowerCase().includes(searchTerm) ||
                        cmd.description.toLowerCase().includes(searchTerm) ||
                        cmd.shortcut?.toLowerCase() === searchTerm);
                }).map((cmd) => ({
                    name: formatCommandChoice(cmd),
                    value: cmd.action,
                    description: cmd.description,
                }));
            },
        });
        return answer;
    }
    catch (error) {
        // User cancelled (Ctrl+C)
        if (error.message?.includes("cancelled") || error.name === "ExitPromptError") {
            return null;
        }
        throw error;
    }
}
