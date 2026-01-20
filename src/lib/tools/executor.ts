import { Tool, ToolRegistry } from './base';
import { ToolResult, ToolCall } from '../../types';
import { SafetyChecker } from '../safety';
import { log } from '../ui';
import { tracker } from '../tracker';
import ora from 'ora';

/**
 * Executes tools called by the AI
 */
export class ToolExecutor {
    private registry: ToolRegistry;
    private safetyChecker: SafetyChecker;
    private sessionOverrides: Map<string, boolean> = new Map();

    constructor(registry: ToolRegistry, safetyChecker: SafetyChecker) {
        this.registry = registry;
        this.safetyChecker = safetyChecker;
    }

    /**
     * Execute a single tool call
     */
    async executeSingle(toolCall: ToolCall): Promise<ToolResult> {
        const tool = this.registry.get(toolCall.name);
        const startTime = Date.now();

        if (!tool) {
            tracker.toolError(toolCall.name, 'Tool not found', 0);
            return {
                success: false,
                output: '',
                error: `Tool '${toolCall.name}' not found`
            };
        }

        // Log tool start
        tracker.toolStart(tool.name, toolCall.args);

        try {
            // Check if confirmation is needed
            const needsConfirm = await this.safetyChecker.shouldConfirm(tool, toolCall.args);

            if (needsConfirm) {
                // Check session override
                const overrideKey = `${tool.name}:${JSON.stringify(toolCall.args)}`;
                if (!this.sessionOverrides.get(overrideKey)) {
                    const { confirmed, rememberChoice } = await this.safetyChecker.promptConfirmation(tool, toolCall.args);

                    if (!confirmed) {
                        const duration = Date.now() - startTime;
                        tracker.toolCancelled(tool.name);
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
            const spinner = ora(`Executing ${tool.name}...`).start();
            log.tool(tool.name, 'executing');

            const result = await tool.execute(toolCall.args);
            const duration = Date.now() - startTime;

            if (result.success) {
                spinner.succeed(`${tool.name} completed`);
                log.toolResult(true, result.output);
                // Show formatted output with colors
                if (result.output && result.output.trim()) {
                    log.toolOutput(tool.name, result.output);
                }
                tracker.toolSuccess(tool.name, result.output, duration);
            } else {
                spinner.fail(`${tool.name} failed`);
                log.toolResult(false, result.error || 'Unknown error');
                // Log error with args for debugging
                tracker.toolError(tool.name, result.error || 'Unknown error', duration, toolCall.args);
            }

            return result;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            log.error(`Tool execution error: ${error.message}`);
            tracker.toolError(tool.name, error.message, duration, toolCall.args);
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
    async executeMultiple(toolCalls: ToolCall[]): Promise<ToolResult[]> {
        const results: ToolResult[] = [];

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
    formatResultsAsMessages(toolCalls: ToolCall[], results: ToolResult[]): Array<{
        role: 'tool';
        content: string;
        tool_call_id: string;
        name: string;
    }> {
        return toolCalls.map((call, index) => {
            const result = results[index];
            const content = result.success
                ? result.output
                : `Error: ${result.error}`;

            return {
                role: 'tool' as const,
                content,
                tool_call_id: call.id,
                name: call.name
            };
        });
    }

    /**
     * Clear session overrides (confirmations)
     */
    clearSessionOverrides(): void {
        this.sessionOverrides.clear();
    }
}
