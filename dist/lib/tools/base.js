"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = exports.Tool = void 0;
const tools_1 = require("@langchain/core/tools");
/**
 * Base interface for all tools
 */
class Tool {
    /**
     * Get a short summary of what this tool does for the AI
     */
    getSummary() {
        return `${this.name}: ${this.description}`;
    }
    /**
     * Convert this tool to a LangChain tool for binding to models
     */
    toLangChainTool() {
        return new tools_1.DynamicStructuredTool({
            name: this.name,
            description: this.description,
            schema: this.schema,
            func: async (input) => {
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
    success(output, metadata) {
        return {
            success: true,
            output,
            metadata
        };
    }
    /**
     * Format an error result
     */
    error(error, metadata) {
        return {
            success: false,
            output: '',
            error,
            metadata
        };
    }
}
exports.Tool = Tool;
/**
 * Registry to manage all available tools
 */
class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }
    /**
     * Register a tool
     */
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    /**
     * Get a tool by name
     */
    get(name) {
        return this.tools.get(name);
    }
    /**
     * Get all registered tools
     */
    getAll() {
        return Array.from(this.tools.values());
    }
    /**
     * Get all tools as LangChain tools
     */
    getAllAsLangChainTools() {
        return this.getAll().map(tool => tool.toLangChainTool());
    }
    /**
     * Get a description of all tools for the AI system prompt
     */
    getToolDescriptions() {
        const descriptions = this.getAll().map(tool => {
            const params = Object.keys(tool.schema.shape).join(', ');
            return `- ${tool.name}(${params}): ${tool.description}`;
        });
        return descriptions.join('\n');
    }
    /**
     * Get list of tool names
     */
    getToolNames() {
        return Array.from(this.tools.keys());
    }
    /**
     * Check if a tool exists
     */
    has(name) {
        return this.tools.has(name);
    }
    /**
     * Get count of registered tools
     */
    count() {
        return this.tools.size;
    }
}
exports.ToolRegistry = ToolRegistry;
