"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqProvider = void 0;
const groq_1 = require("@langchain/groq");
const provider_1 = require("./provider");
/**
 * Groq model provider implementation
 * Supports multiple Groq models with function calling
 */
class GroqProvider extends provider_1.ModelProvider {
    constructor(modelId = 'llama-3.3-70b-versatile', temperature = 0.7) {
        super();
        this.name = 'groq';
        this.supportsFunctionCalling = true;
        this.model = null;
        this.apiKey = '';
        this.temperature = 0.7;
        this.modelId = modelId;
        this.temperature = temperature;
    }
    /**
     * Initialize the Groq model
     */
    initialize(apiKey, modelId) {
        this.apiKey = apiKey;
        if (modelId) {
            this.modelId = modelId;
        }
        this.model = new groq_1.ChatGroq({
            apiKey: this.apiKey,
            model: this.modelId,
            temperature: this.temperature
        });
    }
    /**
     * Stream chat with optional tool support
     */
    async *streamChat(messages, tools) {
        if (!this.model) {
            throw new Error('Model not initialized. Call initialize() first.');
        }
        // Bind tools if provided
        const modelToUse = tools && tools.length > 0
            ? this.model.bindTools(tools)
            : this.model;
        // Stream the response
        const stream = await modelToUse.stream(messages);
        for await (const chunk of stream) {
            yield chunk;
        }
    }
    /**
     * Get model information
     */
    getInfo() {
        return {
            id: this.modelId,
            provider: 'groq',
            capabilities: ['chat', 'streaming', 'function_calling'],
            description: `Groq model: ${this.modelId}`
        };
    }
    /**
     * Update model configuration
     */
    setModel(modelId) {
        this.modelId = modelId;
        if (this.apiKey) {
            this.initialize(this.apiKey, modelId);
        }
    }
    /**
     * Update temperature
     */
    setTemperature(temperature) {
        this.temperature = temperature;
        if (this.apiKey) {
            this.initialize(this.apiKey, this.modelId);
        }
    }
}
exports.GroqProvider = GroqProvider;
