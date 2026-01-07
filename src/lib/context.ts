import simpleGit from 'simple-git';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';

const git = simpleGit();

export const isGitRepo = async (): Promise<boolean> => {
  try {
    return await git.checkIsRepo();
  } catch (e) {
    return false;
  }
};

export const getFileTree = async (cwd: string = process.cwd()): Promise<string[]> => {
    // Ignore node_modules, .git, dist, etc.
    const ignore = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.env', '**/*.lock'];
    const files = await glob('**/*', { cwd, ignore, nodir: true });
    return files;
};

export const getFileContent = (filePath: string): string => {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return '';
    }
}
