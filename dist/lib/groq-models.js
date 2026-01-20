"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGroqModels = fetchGroqModels;
exports.groupModelsByOwner = groupModelsByOwner;
exports.formatContextWindow = formatContextWindow;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
/**
 * Fetch available models from Groq API
 */
async function fetchGroqModels(apiKey) {
    try {
        const groq = new groq_sdk_1.default({ apiKey });
        const response = await groq.models.list();
        // Filter and sort models
        const models = response.data
            .filter((m) => m.active !== false)
            .sort((a, b) => a.id.localeCompare(b.id));
        return models;
    }
    catch (error) {
        console.error("Failed to fetch models:", error.message);
        return [];
    }
}
/**
 * Group models by provider/owner
 */
function groupModelsByOwner(models) {
    const groups = new Map();
    for (const model of models) {
        const owner = model.owned_by || "Other";
        if (!groups.has(owner)) {
            groups.set(owner, []);
        }
        groups.get(owner).push(model);
    }
    return groups;
}
/**
 * Format context window size
 */
function formatContextWindow(tokens) {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(0)}M`;
    }
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(0)}K`;
    }
    return `${tokens}`;
}
