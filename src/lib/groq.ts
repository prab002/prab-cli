import Groq from 'groq-sdk';
import { getApiKey } from './config';

let groqClient: Groq | null = null;

export const initGroq = () => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('API Key not found');
    }
    groqClient = new Groq({ apiKey });
};

export type Message = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export const streamChat = async (messages: Message[]) => {
    if (!groqClient) initGroq();
    
    // Default model to llama-3.3-70b-versatile
    return await groqClient!.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile', 
        stream: true,
    });
};
