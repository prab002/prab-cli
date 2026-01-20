"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCustomization = exports.setTheme = exports.setUserName = exports.setCliName = exports.getCustomization = exports.clearSessionData = exports.setSessionData = exports.getSessionData = exports.setPreference = exports.getPreferences = exports.setActiveModel = exports.getModelConfig = exports.clearApiKey = exports.setApiKey = exports.getApiKey = exports.getConfig = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const registry_1 = require("./models/registry");
const DEFAULT_CLI_NAME = "Prab CLI";
const CONFIG_DIR = path_1.default.join(os_1.default.homedir(), ".config", "groq-cli-tool");
const CONFIG_FILE = path_1.default.join(CONFIG_DIR, "config.json");
const ensureConfigDir = () => {
    if (!fs_1.default.existsSync(CONFIG_DIR)) {
        fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
    }
};
const readConfig = () => {
    try {
        if (!fs_1.default.existsSync(CONFIG_FILE))
            return {};
        return JSON.parse(fs_1.default.readFileSync(CONFIG_FILE, "utf-8"));
    }
    catch {
        return {};
    }
};
const writeConfig = (data) => {
    ensureConfigDir();
    fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
};
/**
 * Get full config with defaults
 */
const getConfig = () => {
    const config = readConfig();
    // Handle legacy config format (old apiKey -> new apiKeys.groq)
    if ("apiKey" in config && typeof config.apiKey === "string") {
        const legacyKey = config.apiKey;
        delete config.apiKey;
        config.apiKeys = { groq: legacyKey };
        writeConfig(config);
    }
    return {
        apiKeys: config.apiKeys || { groq: "" },
        activeModel: config.activeModel || (0, registry_1.getDefaultModel)(),
        preferences: {
            temperature: config.preferences?.temperature ?? 0.7,
            autoConfirm: config.preferences?.autoConfirm ?? false,
            safeMode: config.preferences?.safeMode ?? true,
            maxTokens: config.preferences?.maxTokens,
        },
        customization: {
            cliName: config.customization?.cliName || DEFAULT_CLI_NAME,
            userName: config.customization?.userName,
            theme: config.customization?.theme || "default",
        },
        session: config.session || { todos: [] },
    };
};
exports.getConfig = getConfig;
/**
 * Get API key (backward compatible)
 */
const getApiKey = () => {
    const config = (0, exports.getConfig)();
    return config.apiKeys.groq || "";
};
exports.getApiKey = getApiKey;
/**
 * Set API key (backward compatible)
 */
const setApiKey = (key) => {
    const config = readConfig();
    if (!config.apiKeys) {
        config.apiKeys = { groq: "" };
    }
    config.apiKeys.groq = key;
    writeConfig(config);
};
exports.setApiKey = setApiKey;
/**
 * Clear API key (backward compatible)
 */
const clearApiKey = () => {
    const config = readConfig();
    if (config.apiKeys) {
        config.apiKeys.groq = "";
    }
    writeConfig(config);
};
exports.clearApiKey = clearApiKey;
/**
 * Get active model configuration
 */
const getModelConfig = () => {
    const config = (0, exports.getConfig)();
    return {
        modelId: config.activeModel,
        temperature: config.preferences.temperature,
    };
};
exports.getModelConfig = getModelConfig;
/**
 * Set active model
 */
const setActiveModel = (modelId) => {
    const config = readConfig();
    config.activeModel = modelId;
    writeConfig(config);
};
exports.setActiveModel = setActiveModel;
/**
 * Get user preferences
 */
const getPreferences = () => {
    return (0, exports.getConfig)().preferences;
};
exports.getPreferences = getPreferences;
/**
 * Set a preference
 */
const setPreference = (key, value) => {
    const config = readConfig();
    if (!config.preferences) {
        config.preferences = {
            temperature: 0.7,
            autoConfirm: false,
            safeMode: true,
        };
    }
    config.preferences[key] = value;
    writeConfig(config);
};
exports.setPreference = setPreference;
/**
 * Get session data (todos, etc.)
 */
const getSessionData = () => {
    const config = (0, exports.getConfig)();
    return config.session || { todos: [] };
};
exports.getSessionData = getSessionData;
/**
 * Set session data
 */
const setSessionData = (data) => {
    const config = readConfig();
    config.session = data;
    writeConfig(config);
};
exports.setSessionData = setSessionData;
/**
 * Clear session data
 */
const clearSessionData = () => {
    const config = readConfig();
    config.session = { todos: [] };
    writeConfig(config);
};
exports.clearSessionData = clearSessionData;
/**
 * Get customization settings
 */
const getCustomization = () => {
    const config = (0, exports.getConfig)();
    return config.customization;
};
exports.getCustomization = getCustomization;
/**
 * Set CLI name
 */
const setCliName = (name) => {
    const config = readConfig();
    if (!config.customization) {
        config.customization = { cliName: DEFAULT_CLI_NAME };
    }
    config.customization.cliName = name;
    writeConfig(config);
};
exports.setCliName = setCliName;
/**
 * Set user name
 */
const setUserName = (name) => {
    const config = readConfig();
    if (!config.customization) {
        config.customization = { cliName: DEFAULT_CLI_NAME };
    }
    config.customization.userName = name;
    writeConfig(config);
};
exports.setUserName = setUserName;
/**
 * Set theme
 */
const setTheme = (theme) => {
    const config = readConfig();
    if (!config.customization) {
        config.customization = { cliName: DEFAULT_CLI_NAME };
    }
    config.customization.theme = theme;
    writeConfig(config);
};
exports.setTheme = setTheme;
/**
 * Reset customization to defaults
 */
const resetCustomization = () => {
    const config = readConfig();
    config.customization = { cliName: DEFAULT_CLI_NAME, theme: "default" };
    writeConfig(config);
};
exports.resetCustomization = resetCustomization;
