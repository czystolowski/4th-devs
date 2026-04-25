/**
 * Simple colored logger for terminal output.
 */

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m"
};

const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });

const log = {
  info: (msg) => console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.green}✓${colors.reset} ${msg}`),
  error: (title, msg) => console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.red}✗ ${title}${colors.reset} ${msg || ""}`),
  warn: (msg) => console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.yellow}⚠${colors.reset} ${msg}`),
  start: (msg) => console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.cyan}→${colors.reset} ${msg}`),
  
  box: (text) => {
    const lines = text.split("\n");
    const width = Math.max(...lines.map(l => l.length)) + 4;
    console.log(`\n${colors.cyan}${"─".repeat(width)}${colors.reset}`);
    for (const line of lines) {
      console.log(`${colors.cyan}│${colors.reset} ${colors.bright}${line.padEnd(width - 3)}${colors.reset}${colors.cyan}│${colors.reset}`);
    }
    console.log(`${colors.cyan}${"─".repeat(width)}${colors.reset}\n`);
  },

  attempt: (num) => console.log(`\n${colors.bgBlue}${colors.white} ATTEMPT ${num} ${colors.reset}\n`),
  
  prompt: (text, tokens) => {
    const truncated = text.length > 200 ? text.substring(0, 200) + "..." : text;
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.magenta}Prompt (${tokens} tokens):${colors.reset} ${truncated}`);
  },

  classification: (id, desc, result, correct) => {
    const icon = correct ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    const truncDesc = desc.length > 50 ? desc.substring(0, 50) + "..." : desc;
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${icon} ${id}: ${result} ${colors.dim}(${truncDesc})${colors.reset}`);
  },

  budget: (used, total) => {
    const percentage = (used / total * 100).toFixed(1);
    const color = used > total ? colors.red : used > total * 0.8 ? colors.yellow : colors.green;
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${color}Budget: ${used.toFixed(3)} / ${total} PP (${percentage}%)${colors.reset}`);
  },

  flag: (flag) => console.log(`\n${colors.bgGreen}${colors.white} FLAG ${colors.reset} ${colors.bright}${flag}${colors.reset}\n`),

  reset: () => console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.yellow}↻${colors.reset} Resetting attempt...`),

  api: (step) => console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.magenta}◆${colors.reset} ${step}`),
  
  reasoning: (summaries) => {
    if (!summaries?.length) return;
    console.log(`${colors.dim}         ${colors.cyan}reasoning:${colors.reset}`);
    for (const summary of summaries) {
      const lines = summary.split("\n");
      for (const line of lines) {
        console.log(`${colors.dim}           ${line}${colors.reset}`);
      }
    }
  }
};

export default log;
