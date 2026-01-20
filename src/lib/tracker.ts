import fs from "fs";
import path from "path";
import os from "os";

/**
 * Log levels for visual display
 */
export type LogLevel = "info" | "success" | "error" | "warn" | "debug" | "api" | "ai";

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  message: string;
  data?: any;
  duration?: number;
}

/**
 * Super Logger - Tracks everything happening in the CLI
 */
class SuperTracker {
  private logDir: string;
  private logFile: string;
  private sessionId: string;

  constructor() {
    this.logDir = path.join(os.homedir(), ".config", "groq-cli-tool", "logs");
    this.sessionId = this.generateSessionId();
    this.logFile = path.join(this.logDir, `session-${this.sessionId}.jsonl`);
    this.ensureLogDir();
  }

  private generateSessionId(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Write a log entry to file (with immediate flush)
   */
  private write(entry: LogEntry): void {
    const line = JSON.stringify(entry) + "\n";
    const fd = fs.openSync(this.logFile, "a");
    fs.writeSync(fd, line);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  }

  /**
   * Log session start
   */
  sessionStart(model: string, toolCount: number): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "SESSION_START",
      message: `Session started with model: ${model}`,
      data: { model, toolCount, sessionId: this.sessionId },
    });
  }

  /**
   * Log user prompt received
   */
  promptReceived(prompt: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "PROMPT_RECEIVED",
      message: `User: "${prompt.length > 100 ? prompt.substring(0, 100) + "..." : prompt}"`,
      data: { prompt, length: prompt.length },
    });
  }

  /**
   * Log API request to Groq
   */
  apiRequest(model: string, messageCount: number, toolCount: number): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "api",
      event: "API_REQUEST",
      message: `Sending request to Groq API`,
      data: { model, messageCount, toolCount },
    });
  }

  /**
   * Log API response from Groq
   */
  apiResponse(
    hasContent: boolean,
    hasToolCalls: boolean,
    toolCallCount: number,
    duration: number
  ): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "api",
      event: "API_RESPONSE",
      message: `Received response from Groq API`,
      data: { hasContent, hasToolCalls, toolCallCount },
      duration,
    });
  }

  /**
   * Log API error
   */
  apiError(error: string, details?: any): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "API_ERROR",
      message: `API Error: ${error}`,
      data: { error, details },
    });
  }

  /**
   * Log AI response text
   */
  aiResponse(content: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "ai",
      event: "AI_RESPONSE",
      message: `AI: "${content.length > 150 ? content.substring(0, 150) + "..." : content}"`,
      data: { content: content.substring(0, 500), length: content.length },
    });
  }

  /**
   * Log AI decided to call tools
   */
  aiToolDecision(toolCalls: Array<{ name: string; args: any }>): void {
    const toolNames = toolCalls.map((t) => t.name).join(", ");
    this.write({
      timestamp: new Date().toISOString(),
      level: "ai",
      event: "AI_TOOL_DECISION",
      message: `AI decided to call: [${toolNames}]`,
      data: { toolCalls },
    });
  }

  /**
   * Log tool execution start
   */
  toolStart(toolName: string, args: any): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "TOOL_START",
      message: `Executing tool: ${toolName}`,
      data: { toolName, args },
    });
  }

  /**
   * Log tool execution success
   */
  toolSuccess(toolName: string, output: string, duration: number): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "success",
      event: "TOOL_SUCCESS",
      message: `Tool completed: ${toolName}`,
      data: { toolName, outputPreview: output.substring(0, 200), outputLength: output.length },
      duration,
    });
  }

  /**
   * Log tool execution failure
   */
  toolError(toolName: string, error: string, duration: number, args?: any): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "TOOL_ERROR",
      message: `Tool failed: ${toolName}`,
      data: { toolName, error, args, errorMessage: error },
      duration,
    });
  }

  /**
   * Log tool cancelled by user
   */
  toolCancelled(toolName: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "warn",
      event: "TOOL_CANCELLED",
      message: `Tool cancelled by user: ${toolName}`,
      data: { toolName },
    });
  }

  /**
   * Log model initialization
   */
  modelInit(modelId: string, provider: string, success: boolean, error?: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: success ? "success" : "error",
      event: "MODEL_INIT",
      message: success ? `Model initialized: ${modelId}` : `Model init failed: ${error}`,
      data: { modelId, provider, success, error },
    });
  }

  /**
   * Log model switch
   */
  modelSwitch(fromModel: string, toModel: string, success: boolean): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: success ? "success" : "error",
      event: "MODEL_SWITCH",
      message: success
        ? `Switched model: ${fromModel} -> ${toModel}`
        : `Model switch failed: ${fromModel} -> ${toModel}`,
      data: { fromModel, toModel, success },
    });
  }

  /**
   * Log prompt processing complete
   */
  promptComplete(prompt: string, duration: number, iterations: number): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "success",
      event: "PROMPT_COMPLETE",
      message: `Prompt processed successfully`,
      data: { promptPreview: prompt.substring(0, 50), iterations },
      duration,
    });
  }

  /**
   * Log prompt processing failed
   */
  promptFailed(prompt: string, error: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "PROMPT_FAILED",
      message: `Prompt processing failed: ${error}`,
      data: { promptPreview: prompt.substring(0, 50), error },
    });
  }

  /**
   * Log streaming chunk received
   */
  streamChunk(hasContent: boolean, hasToolCalls: boolean): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "debug",
      event: "STREAM_CHUNK",
      message: `Stream chunk: content=${hasContent}, tools=${hasToolCalls}`,
      data: { hasContent, hasToolCalls },
    });
  }

  /**
   * Log iteration in the response loop
   */
  iteration(count: number, reason: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "debug",
      event: "ITERATION",
      message: `Loop iteration ${count}: ${reason}`,
      data: { count, reason },
    });
  }

  /**
   * Log context attachment
   */
  contextAttached(files: string[]): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "CONTEXT_ATTACHED",
      message: `Attached ${files.length} file(s) for context`,
      data: { files },
    });
  }

  /**
   * Generic debug log
   */
  debug(message: string, data?: any): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "debug",
      event: "DEBUG",
      message,
      data,
    });
  }

  /**
   * Generic warning log
   */
  warn(message: string, data?: any): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "warn",
      event: "WARNING",
      message,
      data,
    });
  }

  /**
   * Generic error log
   */
  error(message: string, error?: Error | string, data?: any): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "ERROR",
      message,
      data: {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        ...data,
      },
    });
  }

  /**
   * Get log file path
   */
  getLogFile(): string {
    return this.logFile;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance
export const tracker = new SuperTracker();
