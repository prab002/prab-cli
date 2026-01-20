"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFile = exports.getFileContent = exports.getFileTree = exports.isGitRepo = void 0;
const simple_git_1 = __importDefault(require("simple-git"));
const glob_1 = require("glob");
const fs_1 = __importDefault(require("fs"));
const git = (0, simple_git_1.default)();
const isGitRepo = async () => {
    try {
        return await git.checkIsRepo();
    }
    catch {
        return false;
    }
};
exports.isGitRepo = isGitRepo;
const getFileTree = async (cwd = process.cwd()) => {
    // Ignore node_modules, .git, dist, etc.
    const ignore = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.env", "**/*.lock"];
    const files = await (0, glob_1.glob)("**/*", { cwd, ignore, nodir: true });
    return files;
};
exports.getFileTree = getFileTree;
const getFileContent = (filePath) => {
    try {
        return fs_1.default.readFileSync(filePath, "utf-8");
    }
    catch {
        return "";
    }
};
exports.getFileContent = getFileContent;
const writeFile = (filePath, content) => {
    fs_1.default.writeFileSync(filePath, content, "utf-8");
};
exports.writeFile = writeFile;
