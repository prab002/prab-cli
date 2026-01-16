"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_REGISTRY = void 0;
exports.getModelInfo = getModelInfo;
exports.isValidModel = isValidModel;
exports.getAllModelIds = getAllModelIds;
exports.getDefaultModel = getDefaultModel;
exports.getModelList = getModelList;
exports.validateModelId = validateModelId;
/**
 * Registry of available models with their metadata
 * Note: Whisper models are excluded as they are audio transcription models, not chat models
 */
exports.MODEL_REGISTRY = {
    // OpenAI-compatible models on Groq - Better function calling
    'openai/gpt-oss-20b': {
        id: 'openai/gpt-oss-20b',
        provider: 'groq',
        capabilities: ['chat', 'streaming', 'function_calling'],
        description: 'GPT-OSS 20B - OpenAI-compatible model with better function calling'
    },
    // Groq Models
    'llama-3.3-70b-versatile': {
        id: 'llama-3.3-70b-versatile',
        provider: 'groq',
        capabilities: ['chat', 'streaming', 'function_calling'],
        description: 'Llama 3.3 70B - Fast and versatile, great for coding tasks'
    },
    'llama-3.1-70b-versatile': {
        id: 'llama-3.1-70b-versatile',
        provider: 'groq',
        capabilities: ['chat', 'streaming', 'function_calling'],
        description: 'Llama 3.1 70B - Versatile model for various tasks'
    },
    'llama-3.1-8b-instant': {
        id: 'llama-3.1-8b-instant',
        provider: 'groq',
        capabilities: ['chat', 'streaming', 'function_calling'],
        description: 'Llama 3.1 8B - Fast and efficient for quick responses'
    },
    'mixtral-8x7b-32768': {
        id: 'mixtral-8x7b-32768',
        provider: 'groq',
        capabilities: ['chat', 'streaming', 'function_calling'],
        description: 'Mixtral 8x7B - Excellent for complex reasoning'
    },
    'gemma2-9b-it': {
        id: 'gemma2-9b-it',
        provider: 'groq',
        capabilities: ['chat', 'streaming', 'function_calling'],
        description: 'Gemma 2 9B - Google\'s efficient instruction-tuned model'
    }
};
/**
 * Get model information by ID
 */
function getModelInfo(modelId) {
    return exports.MODEL_REGISTRY[modelId];
}
/**
 * Check if a model ID is valid
 */
function isValidModel(modelId) {
    return modelId in exports.MODEL_REGISTRY;
}
/**
 * Get all available model IDs
 */
function getAllModelIds() {
    return Object.keys(exports.MODEL_REGISTRY);
}
/**
 * Get default model ID
 */
function getDefaultModel() {
    return 'openai/gpt-oss-20b';
}
/**
 * Get formatted list of models for display
 */
function getModelList() {
    return Object.values(exports.MODEL_REGISTRY)
        .map(model => `  ${model.id}\n    ${model.description}`)
        .join('\n\n');
}
/**
 * Validate and sanitize model ID
 */
function validateModelId(modelId) {
    if (isValidModel(modelId)) {
        return { valid: true };
    }
    // Try to find similar models
    const allIds = getAllModelIds();
    const similar = allIds.find(id => id.toLowerCase().includes(modelId.toLowerCase()));
    return {
        valid: false,
        error: `Invalid model ID: ${modelId}`,
        suggested: similar
    };
}
