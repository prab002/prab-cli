import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { getApiKey } from "./config";

let model: ChatGroq | null = null;

export const initGroq = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  model = new ChatGroq({
    apiKey,
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
  });
};

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const streamChat = async (messages: Message[]) => {
  if (!model) initGroq();

  const langChainMessages: BaseMessage[] = messages.map((m) => {
    if (m.role === "system") return new SystemMessage(m.content);
    if (m.role === "user") return new HumanMessage(m.content);
    return new AIMessage(m.content);
  });

  const stream = await model!.stream(langChainMessages);
  return stream;
};
