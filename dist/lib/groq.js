"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamChat = exports.initGroq = void 0;
const groq_1 = require("@langchain/groq");
const messages_1 = require("@langchain/core/messages");
const config_1 = require("./config");
let model = null;
const initGroq = () => {
    const apiKey = (0, config_1.getApiKey)();
    if (!apiKey) {
        throw new Error("API Key not found");
    }
    model = new groq_1.ChatGroq({
        apiKey,
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
    });
};
exports.initGroq = initGroq;
const streamChat = async (messages) => {
    if (!model)
        (0, exports.initGroq)();
    const langChainMessages = messages.map((m) => {
        if (m.role === "system")
            return new messages_1.SystemMessage(m.content);
        if (m.role === "user")
            return new messages_1.HumanMessage(m.content);
        return new messages_1.AIMessage(m.content);
    });
    const stream = await model.stream(langChainMessages);
    return stream;
};
exports.streamChat = streamChat;
