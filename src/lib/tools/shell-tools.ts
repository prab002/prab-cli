import { z } from 'zod';
import { Tool } from './base';
import { ToolResult } from '../../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Execute bash commands
 */
export class BashTool extends Tool {
    name = 'bash';
    description = 'Execute bash/shell commands with timeout. Use for running terminal commands, scripts, or system operations.';
    requiresConfirmation = true;
    destructive = true;

    schema = z.object({
        command: z.string().describe('The shell command to execute'),
        description: z.string().optional().describe('Brief description of what this command does'),
        timeout: z.number().optional().describe('Timeout in milliseconds (default: 120000ms, max: 600000ms)')
    });

    // Dangerous commands that always require explicit confirmation
    private dangerousPatterns = [
        /rm\s+-rf\s+\//,
        /mkfs/,
        /dd\s+if=/,
        />\s*\/dev\/sd/,
        /chmod\s+-R\s+777/,
        /chown\s+-R/,
        /:(){ :|:& };:/  // Fork bomb
    ];

    private isDangerous(command: string): boolean {
        return this.dangerousPatterns.some(pattern => pattern.test(command));
    }

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            // Safety check for dangerous commands
            if (this.isDangerous(params.command)) {
                return this.error(
                    `Dangerous command detected and blocked: "${params.command}". ` +
                    `This command could cause system damage. Please run it manually if you're certain.`
                );
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

            return this.success(
                `Command executed: ${params.command}\n\nOutput:\n${output || '(no output)'}`,
                {
                    command: params.command,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    hasError: stderr.length > 0
                }
            );
        } catch (error: any) {
            // Handle timeout
            if (error.killed && error.signal === 'SIGTERM') {
                return this.error(`Command timed out after ${params.timeout || 120000}ms: ${params.command}`);
            }

            // Handle command failure
            const errorOutput = error.stdout || error.stderr || error.message;
            return this.error(
                `Command failed: ${params.command}\nExit code: ${error.code || 'unknown'}\nOutput:\n${errorOutput}`
            );
        }
    }
}
