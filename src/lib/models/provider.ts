import { BaseMessage } from '@langchain/core/messages';
import { ModelProvider as IModelProvider } from '../../types';

/**
 * Abstract base class for model providers
 * Implementations handle specific AI service integrations
 */
export abstract class ModelProvider implements IModelProvider {
    abstract name: string;
    abstract modelId: string;
    abstract supportsFunctionCalling: boolean;

    /**
     * Initialize the model provider with credentials
     */
    abstract initialize(apiKey: string, modelId: string): void;

    /**
     * Stream chat responses with optional tool support
     */
    abstract streamChat(
        messages: BaseMessage[],
        tools?: any[]
    ): AsyncGenerator<any, void, unknown>;

    /**
     * Get model info and capabilities
     */
    abstract getInfo(): {
        id: string;
        provider: string;
        capabilities: string[];
        description: string;
    };
}
