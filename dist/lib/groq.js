"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamChat = exports.initGroq = void 0;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const config_1 = require("./config");
let groqClient = null;
const initGroq = () => {
    const apiKey = (0, config_1.getApiKey)();
    if (!apiKey) {
        throw new Error('API Key not found');
    }
    groqClient = new groq_sdk_1.default({ apiKey });
};
exports.initGroq = initGroq;
const streamChat = async (messages) => {
    if (!groqClient)
        (0, exports.initGroq)();
    // Default model to llama-3.3-70b-versatile
    return await groqClient.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        stream: true,
    });
};
exports.streamChat = streamChat;
