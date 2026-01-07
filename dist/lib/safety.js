"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafetyChecker = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const config_1 = require("./config");
/**
 * Safety checker for tool operations
 * Determines when to ask for user confirmation
 */
class SafetyChecker {
    /**
     * Check if a tool operation should require confirmation
     */
    async shouldConfirm(tool, params) {
        const prefs = (0, config_1.getPreferences)();
        // If autoConfirm is true and safeMode is false, skip most confirmations
        if (prefs.autoConfirm && !prefs.safeMode) {
            // Still confirm for extremely dangerous operations
            return this.isExtremelyDangerous(tool, params);
        }
        // Safe mode: always confirm destructive operations
        if (prefs.safeMode && tool.destructive) {
            return true;
        }
        // Regular mode: confirm based on tool requirements
        return tool.requiresConfirmation;
    }
    /**
     * Check if an operation is extremely dangerous (always confirm)
     */
    isExtremelyDangerous(tool, params) {
        // Git operations that can't be easily undone
        if (tool.name === 'git_push' && params.force) {
            return true;
        }
        if (tool.name === 'git_branch' && params.action === 'delete') {
            return true;
        }
        // Shell commands with dangerous patterns
        if (tool.name === 'bash') {
            const dangerous = [
                /rm\s+-rf/,
                /rm\s+.*\/\*/,
                />\s*\/dev/,
                /dd\s+if=/,
                /mkfs/,
                /format/i
            ];
            return dangerous.some(pattern => pattern.test(params.command));
        }
        return false;
    }
    /**
     * Prompt user for confirmation
     */
    async promptConfirmation(tool, params) {
        const description = this.getOperationDescription(tool, params);
        console.log('\n⚠️  Confirmation required:');
        console.log(`Tool: ${tool.name}`);
        console.log(`Operation: ${description}`);
        console.log('');
        const { proceed, remember } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: 'Do you want to proceed with this operation?',
                default: false
            },
            {
                type: 'confirm',
                name: 'remember',
                message: 'Remember this choice for similar operations in this session?',
                default: false,
                when: (answers) => answers.proceed
            }
        ]);
        return {
            confirmed: proceed,
            rememberChoice: remember || false
        };
    }
    /**
     * Get a human-readable description of the operation
     */
    getOperationDescription(tool, params) {
        switch (tool.name) {
            case 'write_file':
                return `Write to file: ${params.file_path}`;
            case 'edit_file':
                return `Edit file: ${params.file_path} (replace "${params.search.substring(0, 50)}...")`;
            case 'bash':
                return `Execute command: ${params.command}`;
            case 'git_commit':
                const files = params.files ? ` (${params.files.length} files)` : '';
                return `Create git commit${files}: "${params.message}"`;
            case 'git_push':
                const force = params.force ? ' (FORCE)' : '';
                return `Push to remote${force}: ${params.branch || 'current branch'}`;
            case 'git_branch':
                return `${params.action} branch: ${params.name || 'N/A'}`;
            default:
                return JSON.stringify(params, null, 2);
        }
    }
}
exports.SafetyChecker = SafetyChecker;
