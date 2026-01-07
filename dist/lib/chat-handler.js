"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHandler = void 0;
const messages_1 = require("@langchain/core/messages");
const context_1 = require("./context");
const ui_1 = require("./ui");
/**
 * Handles chat interactions with AI, tool calling, and context management
 */
class ChatHandler {
    constructor(toolRegistry, toolExecutor, modelProvider, initialContext) {
        this.messages = [];
        this.contextMessage = '';
        this.toolRegistry = toolRegistry;
        this.toolExecutor = toolExecutor;
        this.modelProvider = modelProvider;
        this.contextMessage = initialContext;
        // Initialize with system message
        this.initializeSystemMessage();
    }
    /**
     * Initialize system message with tool descriptions and context
     */
    initializeSystemMessage() {
        const toolDescriptions = this.toolRegistry.getToolDescriptions();
        const systemPrompt = `You are an expert AI coding assistant with access to powerful tools for file operations, shell commands, and git management.

Available Tools:
${toolDescriptions}

Guidelines:
- Use tools proactively to read, edit, and create files when the user asks for code changes
- For multi-step tasks, use the manage_todos tool to track progress
- Always use read_file before editing files to understand the current content
- Use glob and grep to explore unfamiliar codebases
- Provide clear explanations of what you're doing
- Ask for clarification if requirements are ambiguous

${this.contextMessage}

When you need to perform file operations, use the appropriate tools rather than just suggesting changes.`;
        this.messages.push(new messages_1.SystemMessage(systemPrompt));
    }
    /**
     * Process user input and generate response with tool support
     */
    async processUserInput(input) {
        try {
            // Auto-attach file context if files are mentioned
            const attachedFiles = await this.attachMentionedFiles(input);
            let finalInput = input;
            if (attachedFiles.length > 0) {
                ui_1.log.info(`Attached context for: ${attachedFiles.join(', ')}`);
            }
            // Add user message
            this.messages.push(new messages_1.HumanMessage(finalInput));
            // Get tools as LangChain tools
            const tools = this.toolRegistry.getAllAsLangChainTools();
            // Main response loop (handles tool calls)
            let continueLoop = true;
            let iterationCount = 0;
            const maxIterations = 10; // Prevent infinite loops
            while (continueLoop && iterationCount < maxIterations) {
                iterationCount++;
                // Stream response from model
                const stream = this.modelProvider.streamChat(this.messages, tools);
                let fullResponse = '';
                let toolCalls = [];
                process.stdout.write('\n');
                for await (const chunk of stream) {
                    // Handle text content
                    if (chunk.content && typeof chunk.content === 'string') {
                        process.stdout.write(chunk.content);
                        fullResponse += chunk.content;
                    }
                    // Handle tool calls
                    if (chunk.tool_calls && chunk.tool_calls.length > 0) {
                        toolCalls = chunk.tool_calls;
                    }
                }
                process.stdout.write('\n\n');
                // If we have tool calls, execute them
                if (toolCalls.length > 0) {
                    // Add AI message with tool calls
                    this.messages.push(new messages_1.AIMessage({
                        content: fullResponse,
                        tool_calls: toolCalls
                    }));
                    // Execute tools
                    const results = await this.executeToolCalls(toolCalls);
                    // Add tool results as messages
                    for (let i = 0; i < toolCalls.length; i++) {
                        const toolCall = toolCalls[i];
                        const result = results[i];
                        this.messages.push(new messages_1.ToolMessage({
                            content: result.success ? result.output : `Error: ${result.error}`,
                            tool_call_id: toolCall.id,
                            name: toolCall.name
                        }));
                    }
                    // Continue loop to get AI's response after tool execution
                    continue;
                }
                else {
                    // No tool calls, add final AI message and end loop
                    this.messages.push(new messages_1.AIMessage(fullResponse));
                    continueLoop = false;
                }
            }
            if (iterationCount >= maxIterations) {
                ui_1.log.warning('Maximum iteration limit reached. Ending conversation turn.');
            }
        }
        catch (error) {
            ui_1.log.error(`Error: ${error.message}`);
        }
    }
    /**
     * Execute tool calls from AI
     */
    async executeToolCalls(toolCalls) {
        const formattedCalls = toolCalls.map(tc => ({
            id: tc.id || `call-${Date.now()}`,
            name: tc.name,
            args: tc.args || {}
        }));
        return await this.toolExecutor.executeMultiple(formattedCalls);
    }
    /**
     * Auto-attach file context for mentioned files
     */
    async attachMentionedFiles(input) {
        const allFiles = await (0, context_1.getFileTree)();
        const attached = [];
        for (const file of allFiles) {
            const base = file.split('/').pop() || '';
            const isBaseMatch = base.length > 2 && input.includes(base);
            const isPathMatch = input.includes(file);
            if (isPathMatch || isBaseMatch) {
                const content = (0, context_1.getFileContent)(file);
                if (content) {
                    // Add file content to the messages as context
                    attached.push(file);
                }
            }
        }
        return attached;
    }
    /**
     * Clear chat history but keep system message
     */
    clearHistory() {
        const systemMsg = this.messages[0];
        this.messages = [systemMsg];
    }
    /**
     * Get message count
     */
    getMessageCount() {
        return this.messages.length;
    }
    /**
     * Update context (e.g., if file tree changes)
     */
    updateContext(newContext) {
        this.contextMessage = newContext;
        // Re-initialize system message with new context
        const systemMsg = this.messages[0];
        this.messages[0] = systemMsg; // Keep the same message for now
        // In a more sophisticated implementation, we'd rebuild the system message
    }
}
exports.ChatHandler = ChatHandler;
