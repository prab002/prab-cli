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
    
    // Default model to mixtral or llama3 if available, user can change later if needed
    // 'llama3-70b-8192' is a good default for coding
    return await groqClient!.chat.completions.create({
        messages,
        model: 'llama3-70b-8192', 
        stream: true,
    });
};
