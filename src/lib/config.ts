import fs from "fs";
import path from "path";
import os from "os";
import { Config, TodoItem } from "../types";
import { getDefaultModel } from "./models/registry";

const CONFIG_DIR = path.join(os.homedir(), ".config", "groq-cli-tool");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const ensureConfigDir = () => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

const readConfig = (): Partial<Config> => {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
};

const writeConfig = (data: Partial<Config>) => {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
};

/**
 * Get full config with defaults
 */
export const getConfig = (): Config => {
  const config = readConfig();

  // Handle legacy config format (old apiKey -> new apiKeys.groq)
  if ("apiKey" in config && typeof config.apiKey === "string") {
    const legacyKey = config.apiKey as string;
    delete (config as any).apiKey;
    config.apiKeys = { groq: legacyKey };
    writeConfig(config);
  }

  return {
    apiKeys: config.apiKeys || { groq: "" },
    activeModel: config.activeModel || getDefaultModel(),
    preferences: {
      temperature: config.preferences?.temperature ?? 0.7,
      autoConfirm: config.preferences?.autoConfirm ?? false,
      safeMode: config.preferences?.safeMode ?? true,
      maxTokens: config.preferences?.maxTokens,
    },
    session: config.session || { todos: [] },
  };
};

/**
 * Get API key (backward compatible)
 */
export const getApiKey = (): string => {
  const config = getConfig();
  return config.apiKeys.groq || "";
};

/**
 * Set API key (backward compatible)
 */
export const setApiKey = (key: string): void => {
  const config = readConfig();
  if (!config.apiKeys) {
    config.apiKeys = { groq: "" };
  }
  config.apiKeys.groq = key;
  writeConfig(config);
};

/**
 * Clear API key (backward compatible)
 */
export const clearApiKey = (): void => {
  const config = readConfig();
  if (config.apiKeys) {
    config.apiKeys.groq = "";
  }
  writeConfig(config);
};

/**
 * Get active model configuration
 */
export const getModelConfig = (): { modelId: string; temperature: number } => {
  const config = getConfig();
  return {
    modelId: config.activeModel,
    temperature: config.preferences.temperature,
  };
};

/**
 * Set active model
 */
export const setActiveModel = (modelId: string): void => {
  const config = readConfig();
  config.activeModel = modelId;
  writeConfig(config);
};

/**
 * Get user preferences
 */
export const getPreferences = () => {
  return getConfig().preferences;
};

/**
 * Set a preference
 */
export const setPreference = (key: keyof Config["preferences"], value: any): void => {
  const config = readConfig();
  if (!config.preferences) {
    config.preferences = {
      temperature: 0.7,
      autoConfirm: false,
      safeMode: true,
    };
  }
  (config.preferences as any)[key] = value;
  writeConfig(config);
};

/**
 * Get session data (todos, etc.)
 */
export const getSessionData = (): { todos: TodoItem[] } => {
  const config = getConfig();
  return config.session || { todos: [] };
};

/**
 * Set session data
 */
export const setSessionData = (data: { todos: TodoItem[] }): void => {
  const config = readConfig();
  config.session = data;
  writeConfig(config);
};

/**
 * Clear session data
 */
export const clearSessionData = (): void => {
  const config = readConfig();
  config.session = { todos: [] };
  writeConfig(config);
};
