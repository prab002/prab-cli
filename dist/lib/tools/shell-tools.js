"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BashTool = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
/**
 * Execute bash commands
 */
class BashTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'bash';
        this.description = 'Execute bash/shell commands with timeout. Use for running terminal commands, scripts, or system operations.';
        this.requiresConfirmation = true;
        this.destructive = true;
        this.schema = zod_1.z.object({
            command: zod_1.z.string().describe('The shell command to execute'),
            description: zod_1.z.string().optional().describe('Brief description of what this command does'),
            timeout: zod_1.z.number().optional().describe('Timeout in milliseconds (default: 120000ms, max: 600000ms)')
        });
        // Dangerous commands that always require explicit confirmation
        this.dangerousPatterns = [
            /rm\s+-rf\s+\//,
            /mkfs/,
            /dd\s+if=/,
            />\s*\/dev\/sd/,
            /chmod\s+-R\s+777/,
            /chown\s+-R/,
            /:(){ :|:& };:/ // Fork bomb
        ];
    }
    isDangerous(command) {
        return this.dangerousPatterns.some(pattern => pattern.test(command));
    }
    async execute(params) {
        try {
            // Safety check for dangerous commands
            if (this.isDangerous(params.command)) {
                return this.error(`Dangerous command detected and blocked: "${params.command}". ` +
                    `This command could cause system damage. Please run it manually if you're certain.`);
            }
            const timeout = params.timeout && params.timeout <= 600000
                ? params.timeout
                : 120000; // Default 2 minutes
            // Execute command
            const { stdout, stderr } = await execPromise(params.command, {
                timeout,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                cwd: process.cwd()
            });
            const output = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
            return this.success(`Command executed: ${params.command}\n\nOutput:\n${output || '(no output)'}`, {
                command: params.command,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                hasError: stderr.length > 0
            });
        }
        catch (error) {
            // Handle timeout
            if (error.killed && error.signal === 'SIGTERM') {
                return this.error(`Command timed out after ${params.timeout || 120000}ms: ${params.command}`);
            }
            // Handle command failure
            const errorOutput = error.stdout || error.stderr || error.message;
            return this.error(`Command failed: ${params.command}\nExit code: ${error.code || 'unknown'}\nOutput:\n${errorOutput}`);
        }
    }
}
exports.BashTool = BashTool;
