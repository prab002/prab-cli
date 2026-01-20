import Groq from 'groq-sdk';

export interface GroqModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
    active: boolean;
    context_window: number;
}

/**
 * Fetch available models from Groq API
 */
export async function fetchGroqModels(apiKey: string): Promise<GroqModel[]> {
    try {
        const groq = new Groq({ apiKey });
        const response = await groq.models.list();

        // Filter and sort models
        const models = (response.data as GroqModel[])
            .filter(m => m.active !== false)
            .sort((a, b) => a.id.localeCompare(b.id));

        return models;
    } catch (error: any) {
        console.error('Failed to fetch models:', error.message);
        return [];
    }
}

/**
 * Group models by provider/owner
 */
export function groupModelsByOwner(models: GroqModel[]): Map<string, GroqModel[]> {
    const groups = new Map<string, GroqModel[]>();

    for (const model of models) {
        const owner = model.owned_by || 'Other';
        if (!groups.has(owner)) {
            groups.set(owner, []);
        }
        groups.get(owner)!.push(model);
    }

    return groups;
}

/**
 * Format context window size
 */
export function formatContextWindow(tokens: number): string {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(0)}M`;
    }
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(0)}K`;
    }
    return `${tokens}`;
}
