import chalk from 'chalk';

export const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✖'), msg),
  code: (msg: string) => console.log(chalk.gray(msg)),
};

export const banner = () => {
    console.log(chalk.bold.cyan(`
   ______                   _______    ____
  / ____/________  ____ _  / ____/ /   /  _/
 / / __/ ___/ __ \\/ __ \`/ / /   / /    / /  
/ /_/ / /  / /_/ / /_/ / / /___/ /____/ /   
\\____/_/   \\____/\\__, /  \\____/_____/___/   
                /____/                      
`));
}
