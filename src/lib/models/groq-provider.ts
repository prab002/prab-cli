import { ChatGroq } from '@langchain/groq';
import { BaseMessage } from '@langchain/core/messages';
import { ModelProvider } from './provider';

/**
 * Groq model provider implementation
 * Supports multiple Groq models with function calling
 */
export class GroqProvider extends ModelProvider {
    name = 'groq';
    modelId: string;
    supportsFunctionCalling = true;

    private model: ChatGroq | null = null;
    private apiKey: string = '';
    private temperature: number = 0.7;

    constructor(modelId: string = 'llama-3.3-70b-versatile', temperature: number = 0.7) {
        super();
        this.modelId = modelId;
        this.temperature = temperature;
    }

    /**
     * Initialize the Groq model
     */
    initialize(apiKey: string, modelId?: string): void {
        this.apiKey = apiKey;
        if (modelId) {
            this.modelId = modelId;
        }

        this.model = new ChatGroq({
            apiKey: this.apiKey,
            model: this.modelId,
            temperature: this.temperature
        });
    }

    /**
     * Stream chat with optional tool support
     */
    async *streamChat(
        messages: BaseMessage[],
        tools?: any[]
    ): AsyncGenerator<any, void, unknown> {
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
    setModel(modelId: string): void {
        this.modelId = modelId;
        if (this.apiKey) {
            this.initialize(this.apiKey, modelId);
        }
    }

    /**
     * Update temperature
     */
    setTemperature(temperature: number): void {
        this.temperature = temperature;
        if (this.apiKey) {
            this.initialize(this.apiKey, this.modelId);
        }
    }
}
