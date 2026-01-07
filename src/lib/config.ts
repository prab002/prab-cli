import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'groq-cli-tool');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const ensureConfigDir = () => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

const readConfig = (): any => {
    try {
        if (!fs.existsSync(CONFIG_FILE)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
        return {};
    }
};

const writeConfig = (data: any) => {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
};

export const getApiKey = (): string => {
  const config = readConfig();
  return config.apiKey || '';
};

export const setApiKey = (key: string): void => {
  const config = readConfig();
  config.apiKey = key;
  writeConfig(config);
};

export const clearApiKey = (): void => {
  const config = readConfig();
  delete config.apiKey;
  writeConfig(config);
};
