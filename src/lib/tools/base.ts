import { z } from 'zod';
import { ToolResult, ToolSchema } from '../../types';
import { DynamicStructuredTool } from '@langchain/core/tools';

/**
 * Base interface for all tools
 */
export abstract class Tool {
    abstract name: string;
    abstract description: string;
    abstract schema: ToolSchema;
    abstract requiresConfirmation: boolean;
    abstract destructive: boolean;

    /**
     * Execute the tool with the given parameters
     */
    abstract execute(params: z.infer<typeof this.schema>): Promise<ToolResult>;

    /**
     * Get a short summary of what this tool does for the AI
     */
    getSummary(): string {
        return `${this.name}: ${this.description}`;
    }

    /**
     * Convert this tool to a LangChain tool for binding to models
     */
    toLangChainTool(): DynamicStructuredTool {
        return new DynamicStructuredTool({
            name: this.name,
            description: this.description,
            schema: this.schema,
            func: async (input: z.infer<typeof this.schema>) => {
                const result = await this.execute(input);
                if (!result.success) {
                    throw new Error(result.error || 'Tool execution failed');
                }
                return result.output;
            }
        });
    }

    /**
     * Format a successful result
     */
    protected success(output: string, metadata?: Record<string, any>): ToolResult {
        return {
            success: true,
            output,
            metadata
        };
    }

    /**
     * Format an error result
     */
    protected error(error: string, metadata?: Record<string, any>): ToolResult {
        return {
            success: false,
            output: '',
            error,
            metadata
        };
    }
}

/**
 * Registry to manage all available tools
 */
export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    /**
     * Register a tool
     */
    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    /**
     * Get a tool by name
     */
    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Get all registered tools
     */
    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get all tools as LangChain tools
     */
    getAllAsLangChainTools(): DynamicStructuredTool[] {
        return this.getAll().map(tool => tool.toLangChainTool());
    }

    /**
     * Get a description of all tools for the AI system prompt
     */
    getToolDescriptions(): string {
        const descriptions = this.getAll().map(tool => {
            const params = Object.keys(tool.schema.shape).join(', ');
            return `- ${tool.name}(${params}): ${tool.description}`;
        });
        return descriptions.join('\n');
    }

    /**
     * Get list of tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Check if a tool exists
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Get count of registered tools
     */
    count(): number {
        return this.tools.size;
    }
}
