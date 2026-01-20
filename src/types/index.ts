import { z } from "zod";
import { BaseMessage } from "@langchain/core/messages";

// Message Types
export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
};

// Tool Types
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

// Customization Types
export interface Customization {
  cliName: string;
  userName?: string;
  theme?: "default" | "minimal" | "colorful";
}

// Configuration Types
export interface Config {
  apiKeys: {
    groq: string;
  };
  activeModel: string;
  preferences: {
    temperature: number;
    autoConfirm: boolean;
    safeMode: boolean;
    maxTokens?: number;
  };
  customization?: Customization;
  session?: {
    todos: TodoItem[];
  };
}

export interface TodoItem {
  id: string;
  content: string;
  activeForm: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: number;
}

// Model Types
export interface ModelInfo {
  id: string;
  provider: "groq";
  capabilities: string[];
  description: string;
}

export interface ModelProvider {
  name: string;
  modelId: string;
  initialize(apiKey: string, modelId: string): void;
  streamChat(messages: BaseMessage[], tools?: any[]): AsyncGenerator<any, void, unknown>;
  supportsFunctionCalling: boolean;
}

// Tool Schema Types (for Zod validation)
export type ToolSchema = z.ZodObject<any>;

// Export commonly used Zod validators
export { z };
