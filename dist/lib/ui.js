"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.banner = exports.log = void 0;
const chalk_1 = __importDefault(require("chalk"));
exports.log = {
    info: (msg) => console.log(chalk_1.default.blue('ℹ'), msg),
    success: (msg) => console.log(chalk_1.default.green('✔'), msg),
    warning: (msg) => console.log(chalk_1.default.yellow('⚠'), msg),
    error: (msg) => console.log(chalk_1.default.red('✖'), msg),
    code: (msg) => console.log(chalk_1.default.gray(msg)),
};
const banner = () => {
    console.log(chalk_1.default.bold.cyan(`
   ______                   _______    ____
  / ____/________  ____ _  / ____/ /   /  _/
 / / __/ ___/ __ \\/ __ \`/ / /   / /    / /  
/ /_/ / /  / /_/ / /_/ / / /___/ /____/ /   
\\____/_/   \\____/\\__, /  \\____/_____/___/   
                /____/                      
`));
};
exports.banner = banner;
