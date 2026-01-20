import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { ToolRegistry } from "./tools/base";
import { ToolExecutor } from "./tools/executor";
import { ModelProvider } from "./models/provider";
import { ToolCall } from "../types";
import { getFileTree, getFileContent } from "./context";
import { log, StreamFormatter } from "./ui";
import { tracker } from "./tracker";

export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
}

export interface ProcessResult {
  success: boolean;
  error?: string;
  isModelError?: boolean;
  errorType?: "rate_limit" | "model_unavailable" | "auth_error" | "unknown";
}

/**
 * Handles chat interactions with AI, tool calling, and context management
 */
export class ChatHandler {
  private messages: BaseMessage[] = [];
  private toolRegistry: ToolRegistry;
  private toolExecutor: ToolExecutor;
  private modelProvider: ModelProvider;
  private contextMessage: string = "";
  private usage: UsageStats = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    requestCount: 0,
  };

  constructor(
    toolRegistry: ToolRegistry,
    toolExecutor: ToolExecutor,
    modelProvider: ModelProvider,
    initialContext: string
  ) {
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
  private initializeSystemMessage() {
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

    this.messages.push(new SystemMessage(systemPrompt));
  }

  /**
   * Process user input and generate response with tool support
   */
  async processUserInput(input: string): Promise<ProcessResult> {
    const startTime = Date.now();

    // Log prompt received
    tracker.promptReceived(input);

    try {
      // Auto-attach file context if files are mentioned
      const attachedFiles = await this.attachMentionedFiles(input);
      const finalInput = input;

      if (attachedFiles.length > 0) {
        log.info(`Attached context for: ${attachedFiles.join(", ")}`);
        tracker.contextAttached(attachedFiles);
      }

      // Add user message
      this.messages.push(new HumanMessage(finalInput));

      // Get tools as LangChain tools
      const tools = this.toolRegistry.getAllAsLangChainTools();

      // Main response loop (handles tool calls)
      let continueLoop = true;
      let iterationCount = 0;
      const maxIterations = 10; // Prevent infinite loops

      while (continueLoop && iterationCount < maxIterations) {
        iterationCount++;
        tracker.iteration(iterationCount, "Starting API call");

        // Log API request
        tracker.apiRequest(this.modelProvider.modelId, this.messages.length, tools.length);

        const apiStartTime = Date.now();

        // Stream response from model
        const stream = this.modelProvider.streamChat(this.messages, tools);
        let fullResponse = "";
        let toolCalls: any[] = [];
        const formatter = new StreamFormatter();

        process.stdout.write("\n");

        try {
          for await (const chunk of stream) {
            // Handle text content
            if (chunk.content && typeof chunk.content === "string") {
              fullResponse += chunk.content;
              // Format and output the chunk with syntax highlighting
              const formatted = formatter.processChunk(chunk.content);
              if (formatted) {
                process.stdout.write(formatted);
              }
            }

            // Handle tool calls
            if (chunk.tool_calls && chunk.tool_calls.length > 0) {
              toolCalls = chunk.tool_calls;
            }

            // Capture usage metadata from the chunk
            if (chunk.usage_metadata) {
              this.usage.promptTokens += chunk.usage_metadata.input_tokens || 0;
              this.usage.completionTokens += chunk.usage_metadata.output_tokens || 0;
              this.usage.totalTokens += chunk.usage_metadata.total_tokens || 0;
            }
          }

          // Increment request count
          this.usage.requestCount++;

          // Flush any remaining content in the formatter
          const remaining = formatter.flush();
          if (remaining) {
            process.stdout.write(remaining);
          }

          // Log API response
          const apiDuration = Date.now() - apiStartTime;
          tracker.apiResponse(
            fullResponse.length > 0,
            toolCalls.length > 0,
            toolCalls.length,
            apiDuration
          );
        } catch (apiError: any) {
          tracker.apiError(apiError.message, { stack: apiError.stack });
          throw apiError;
        }

        process.stdout.write("\n\n");

        // Log AI response if there's content
        if (fullResponse.length > 0) {
          tracker.aiResponse(fullResponse);
        }

        // If we have tool calls, execute them
        if (toolCalls.length > 0) {
          // Log AI's tool decision
          tracker.aiToolDecision(
            toolCalls.map((tc) => ({
              name: tc.name,
              args: tc.args || {},
            }))
          );

          // Add AI message with tool calls
          this.messages.push(
            new AIMessage({
              content: fullResponse,
              tool_calls: toolCalls,
            })
          );

          // Execute tools
          const results = await this.executeToolCalls(toolCalls);

          // Add tool results as messages
          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            const result = results[i];

            this.messages.push(
              new ToolMessage({
                content: result.success ? result.output : `Error: ${result.error}`,
                tool_call_id: toolCall.id,
                name: toolCall.name,
              })
            );
          }

          tracker.iteration(iterationCount, "Tool execution complete, continuing loop");
          // Continue loop to get AI's response after tool execution
          continue;
        } else {
          // No tool calls, add final AI message and end loop
          this.messages.push(new AIMessage(fullResponse));
          continueLoop = false;
          tracker.iteration(iterationCount, "No tool calls, ending loop");
        }
      }

      if (iterationCount >= maxIterations) {
        log.warning("Maximum iteration limit reached. Ending conversation turn.");
        tracker.warn("Max iterations reached", { iterations: iterationCount });
      }

      // Log success
      const duration = Date.now() - startTime;
      tracker.promptComplete(input, duration, iterationCount);

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      log.error(`Error: ${errorMessage}`);
      tracker.promptFailed(input, errorMessage);
      tracker.error("Chat processing failed", error);

      // Detect model-specific errors
      const isModelError = this.isModelError(errorMessage);
      const errorType = this.classifyError(errorMessage);

      if (isModelError) {
        // Remove the user message so they can retry with a different model
        this.messages.pop();
      }

      return {
        success: false,
        error: errorMessage,
        isModelError,
        errorType,
      };
    }
  }

  /**
   * Check if error is related to the model (rate limit, unavailable, etc.)
   */
  private isModelError(errorMessage: string): boolean {
    const modelErrorPatterns = [
      "rate limit",
      "rate_limit",
      "quota exceeded",
      "model not found",
      "model is not available",
      "model_not_available",
      "overloaded",
      "capacity",
      "too many requests",
      "429",
      "503",
      "502",
      "service unavailable",
      "timeout",
      "context length",
      "maximum context",
      "token limit",
    ];
    const lowerMessage = errorMessage.toLowerCase();
    return modelErrorPatterns.some((pattern) => lowerMessage.includes(pattern));
  }

  /**
   * Classify the type of error
   */
  private classifyError(errorMessage: string): ProcessResult["errorType"] {
    const lowerMessage = errorMessage.toLowerCase();

    if (
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("rate_limit") ||
      lowerMessage.includes("too many requests") ||
      lowerMessage.includes("429")
    ) {
      return "rate_limit";
    }

    if (
      lowerMessage.includes("model not found") ||
      lowerMessage.includes("not available") ||
      lowerMessage.includes("overloaded") ||
      lowerMessage.includes("503") ||
      lowerMessage.includes("502")
    ) {
      return "model_unavailable";
    }

    if (
      lowerMessage.includes("auth") ||
      lowerMessage.includes("api key") ||
      lowerMessage.includes("unauthorized") ||
      lowerMessage.includes("401")
    ) {
      return "auth_error";
    }

    return "unknown";
  }

  /**
   * Execute tool calls from AI
   */
  private async executeToolCalls(toolCalls: any[]): Promise<any[]> {
    const formattedCalls: ToolCall[] = toolCalls.map((tc) => ({
      id: tc.id || `call-${Date.now()}`,
      name: tc.name,
      args: tc.args || {},
    }));

    return await this.toolExecutor.executeMultiple(formattedCalls);
  }

  /**
   * Auto-attach file context for mentioned files
   */
  private async attachMentionedFiles(input: string): Promise<string[]> {
    const allFiles = await getFileTree();
    const attached: string[] = [];

    for (const file of allFiles) {
      const base = file.split("/").pop() || "";
      const isBaseMatch = base.length > 2 && input.includes(base);
      const isPathMatch = input.includes(file);

      if (isPathMatch || isBaseMatch) {
        const content = getFileContent(file);
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
    tracker.debug("Chat history cleared");
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): UsageStats {
    return { ...this.usage };
  }

  /**
   * Update context (e.g., if file tree changes)
   */
  updateContext(newContext: string) {
    this.contextMessage = newContext;
    // Re-initialize system message with new context
    const systemMsg = this.messages[0];
    this.messages[0] = systemMsg; // Keep the same message for now
    // In a more sophisticated implementation, we'd rebuild the system message
  }

  /**
   * Update the model provider (for switching models)
   */
  updateModelProvider(modelProvider: ModelProvider) {
    this.modelProvider = modelProvider;
  }

  /**
   * Get the last user input (for retry after model switch)
   */
  getLastUserInput(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg instanceof HumanMessage) {
        return msg.content as string;
      }
    }
    return null;
  }
}
