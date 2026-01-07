"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolExecutor = void 0;
const ui_1 = require("../ui");
const ora_1 = __importDefault(require("ora"));
/**
 * Executes tools called by the AI
 */
class ToolExecutor {
    constructor(registry, safetyChecker) {
        this.sessionOverrides = new Map();
        this.registry = registry;
        this.safetyChecker = safetyChecker;
    }
    /**
     * Execute a single tool call
     */
    async executeSingle(toolCall) {
        const tool = this.registry.get(toolCall.name);
        if (!tool) {
            return {
                success: false,
                output: '',
                error: `Tool '${toolCall.name}' not found`
            };
        }
        try {
            // Check if confirmation is needed
            const needsConfirm = await this.safetyChecker.shouldConfirm(tool, toolCall.args);
            if (needsConfirm) {
                // Check session override
                const overrideKey = `${tool.name}:${JSON.stringify(toolCall.args)}`;
                if (!this.sessionOverrides.get(overrideKey)) {
                    const { confirmed, rememberChoice } = await this.safetyChecker.promptConfirmation(tool, toolCall.args);
                    if (!confirmed) {
                        return {
                            success: false,
                            output: '',
                            error: 'Operation cancelled by user'
                        };
                    }
                    if (rememberChoice) {
                        this.sessionOverrides.set(overrideKey, true);
                    }
                }
            }
            // Execute the tool with spinner feedback
            const spinner = (0, ora_1.default)(`Executing ${tool.name}...`).start();
            ui_1.log.tool(tool.name, 'executing');
            const result = await tool.execute(toolCall.args);
            if (result.success) {
                spinner.succeed(`${tool.name} completed`);
                ui_1.log.toolResult(true, result.output);
            }
            else {
                spinner.fail(`${tool.name} failed`);
                ui_1.log.toolResult(false, result.error || 'Unknown error');
            }
            return result;
        }
        catch (error) {
            ui_1.log.error(`Tool execution error: ${error.message}`);
            return {
                success: false,
                output: '',
                error: error.message || 'Unknown error occurred'
            };
        }
    }
    /**
     * Execute multiple tool calls in sequence
     */
    async executeMultiple(toolCalls) {
        const results = [];
        for (const toolCall of toolCalls) {
            const result = await this.executeSingle(toolCall);
            results.push(result);
            // If a tool fails, we might want to continue or stop
            // For now, we continue executing remaining tools
        }
        return results;
    }
    /**
     * Format tool results as messages for the AI
     */
    formatResultsAsMessages(toolCalls, results) {
        return toolCalls.map((call, index) => {
            const result = results[index];
            const content = result.success
                ? result.output
                : `Error: ${result.error}`;
            return {
                role: 'tool',
                content,
                tool_call_id: call.id,
                name: call.name
            };
        });
    }
    /**
     * Clear session overrides (confirmations)
     */
    clearSessionOverrides() {
        this.sessionOverrides.clear();
    }
}
exports.ToolExecutor = ToolExecutor;
