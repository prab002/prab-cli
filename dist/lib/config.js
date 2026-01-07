"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearApiKey = exports.setApiKey = exports.getApiKey = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const CONFIG_DIR = path_1.default.join(os_1.default.homedir(), '.config', 'groq-cli-tool');
const CONFIG_FILE = path_1.default.join(CONFIG_DIR, 'config.json');
const ensureConfigDir = () => {
    if (!fs_1.default.existsSync(CONFIG_DIR)) {
        fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
    }
};
const readConfig = () => {
    try {
        if (!fs_1.default.existsSync(CONFIG_FILE))
            return {};
        return JSON.parse(fs_1.default.readFileSync(CONFIG_FILE, 'utf-8'));
    }
    catch {
        return {};
    }
};
const writeConfig = (data) => {
    ensureConfigDir();
    fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
};
const getApiKey = () => {
    const config = readConfig();
    return config.apiKey || '';
};
exports.getApiKey = getApiKey;
const setApiKey = (key) => {
    const config = readConfig();
    config.apiKey = key;
    writeConfig(config);
};
exports.setApiKey = setApiKey;
const clearApiKey = () => {
    const config = readConfig();
    delete config.apiKey;
    writeConfig(config);
};
exports.clearApiKey = clearApiKey;
