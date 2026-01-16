"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracker = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
/**
 * Super Logger - Tracks everything happening in the CLI
 */
class SuperTracker {
    constructor() {
        this.logDir = path_1.default.join(os_1.default.homedir(), '.config', 'groq-cli-tool', 'logs');
        this.sessionId = this.generateSessionId();
        this.logFile = path_1.default.join(this.logDir, `session-${this.sessionId}.jsonl`);
        this.ensureLogDir();
    }
    generateSessionId() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    }
    ensureLogDir() {
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
    }
    /**
     * Write a log entry to file
     */
    write(entry) {
        const line = JSON.stringify(entry) + '\n';
        fs_1.default.appendFileSync(this.logFile, line);
    }
    /**
     * Log session start
     */
    sessionStart(model, toolCount) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'info',
            event: 'SESSION_START',
            message: `Session started with model: ${model}`,
            data: { model, toolCount, sessionId: this.sessionId }
        });
    }
    /**
     * Log user prompt received
     */
    promptReceived(prompt) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'info',
            event: 'PROMPT_RECEIVED',
            message: `User: "${prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}"`,
            data: { prompt, length: prompt.length }
        });
    }
    /**
     * Log API request to Groq
     */
    apiRequest(model, messageCount, toolCount) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'api',
            event: 'API_REQUEST',
            message: `Sending request to Groq API`,
            data: { model, messageCount, toolCount }
        });
    }
    /**
     * Log API response from Groq
     */
    apiResponse(hasContent, hasToolCalls, toolCallCount, duration) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'api',
            event: 'API_RESPONSE',
            message: `Received response from Groq API`,
            data: { hasContent, hasToolCalls, toolCallCount },
            duration
        });
    }
    /**
     * Log API error
     */
    apiError(error, details) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'error',
            event: 'API_ERROR',
            message: `API Error: ${error}`,
            data: { error, details }
        });
    }
    /**
     * Log AI response text
     */
    aiResponse(content) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'ai',
            event: 'AI_RESPONSE',
            message: `AI: "${content.length > 150 ? content.substring(0, 150) + '...' : content}"`,
            data: { content: content.substring(0, 500), length: content.length }
        });
    }
    /**
     * Log AI decided to call tools
     */
    aiToolDecision(toolCalls) {
        const toolNames = toolCalls.map(t => t.name).join(', ');
        this.write({
            timestamp: new Date().toISOString(),
            level: 'ai',
            event: 'AI_TOOL_DECISION',
            message: `AI decided to call: [${toolNames}]`,
            data: { toolCalls }
        });
    }
    /**
     * Log tool execution start
     */
    toolStart(toolName, args) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'info',
            event: 'TOOL_START',
            message: `Executing tool: ${toolName}`,
            data: { toolName, args }
        });
    }
    /**
     * Log tool execution success
     */
    toolSuccess(toolName, output, duration) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'success',
            event: 'TOOL_SUCCESS',
            message: `Tool completed: ${toolName}`,
            data: { toolName, outputPreview: output.substring(0, 200), outputLength: output.length },
            duration
        });
    }
    /**
     * Log tool execution failure
     */
    toolError(toolName, error, duration) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'error',
            event: 'TOOL_ERROR',
            message: `Tool failed: ${toolName} - ${error}`,
            data: { toolName, error },
            duration
        });
    }
    /**
     * Log tool cancelled by user
     */
    toolCancelled(toolName) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'warn',
            event: 'TOOL_CANCELLED',
            message: `Tool cancelled by user: ${toolName}`,
            data: { toolName }
        });
    }
    /**
     * Log model initialization
     */
    modelInit(modelId, provider, success, error) {
        this.write({
            timestamp: new Date().toISOString(),
            level: success ? 'success' : 'error',
            event: 'MODEL_INIT',
            message: success ? `Model initialized: ${modelId}` : `Model init failed: ${error}`,
            data: { modelId, provider, success, error }
        });
    }
    /**
     * Log model switch
     */
    modelSwitch(fromModel, toModel, success) {
        this.write({
            timestamp: new Date().toISOString(),
            level: success ? 'success' : 'error',
            event: 'MODEL_SWITCH',
            message: success ? `Switched model: ${fromModel} -> ${toModel}` : `Model switch failed: ${fromModel} -> ${toModel}`,
            data: { fromModel, toModel, success }
        });
    }
    /**
     * Log prompt processing complete
     */
    promptComplete(prompt, duration, iterations) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'success',
            event: 'PROMPT_COMPLETE',
            message: `Prompt processed successfully`,
            data: { promptPreview: prompt.substring(0, 50), iterations },
            duration
        });
    }
    /**
     * Log prompt processing failed
     */
    promptFailed(prompt, error) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'error',
            event: 'PROMPT_FAILED',
            message: `Prompt processing failed: ${error}`,
            data: { promptPreview: prompt.substring(0, 50), error }
        });
    }
    /**
     * Log streaming chunk received
     */
    streamChunk(hasContent, hasToolCalls) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'debug',
            event: 'STREAM_CHUNK',
            message: `Stream chunk: content=${hasContent}, tools=${hasToolCalls}`,
            data: { hasContent, hasToolCalls }
        });
    }
    /**
     * Log iteration in the response loop
     */
    iteration(count, reason) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'debug',
            event: 'ITERATION',
            message: `Loop iteration ${count}: ${reason}`,
            data: { count, reason }
        });
    }
    /**
     * Log context attachment
     */
    contextAttached(files) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'info',
            event: 'CONTEXT_ATTACHED',
            message: `Attached ${files.length} file(s) for context`,
            data: { files }
        });
    }
    /**
     * Generic debug log
     */
    debug(message, data) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'debug',
            event: 'DEBUG',
            message,
            data
        });
    }
    /**
     * Generic warning log
     */
    warn(message, data) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'warn',
            event: 'WARNING',
            message,
            data
        });
    }
    /**
     * Generic error log
     */
    error(message, error, data) {
        this.write({
            timestamp: new Date().toISOString(),
            level: 'error',
            event: 'ERROR',
            message,
            data: {
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
                ...data
            }
        });
    }
    /**
     * Get log file path
     */
    getLogFile() {
        return this.logFile;
    }
    /**
     * Get session ID
     */
    getSessionId() {
        return this.sessionId;
    }
}
// Singleton instance
exports.tracker = new SuperTracker();
