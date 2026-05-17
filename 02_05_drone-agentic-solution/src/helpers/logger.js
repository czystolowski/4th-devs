/**
 * Logging utilities for agentic drone control system
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
  cyan: "\x1b[36m"
};

const log = {
  box: (title) => {
    const lines = title.split("\n");
    const maxLen = Math.max(...lines.map(l => l.length));
    const border = "═".repeat(maxLen + 4);
    
    console.log(`${colors.cyan}╔${border}╗${colors.reset}`);
    lines.forEach(line => {
      const padding = " ".repeat(maxLen - line.length);
      console.log(`${colors.cyan}║${colors.reset}  ${colors.bright}${line}${padding}${colors.reset}  ${colors.cyan}║${colors.reset}`);
    });
    console.log(`${colors.cyan}╚${border}╝${colors.reset}\n`);
  },

  start: (message) => {
    console.log(`${colors.blue}▶${colors.reset} ${message}`);
  },

  success: (message) => {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
  },

  error: (title, message) => {
    console.log(`${colors.red}✗ ${title}${colors.reset}`);
    if (message) {
      console.log(`  ${colors.dim}${message}${colors.reset}`);
    }
  },

  warning: (message) => {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
  },

  info: (message) => {
    console.log(`${colors.dim}ℹ ${message}${colors.reset}`);
  },

  data: (label, value) => {
    console.log(`${colors.dim}${label}:${colors.reset} ${colors.bright}${value}${colors.reset}`);
  },

  flag: (flag) => {
    console.log(`\n${colors.green}${colors.bright}🚩 FLAG: ${flag}${colors.reset}\n`);
  },

  step: (current, total, message) => {
    console.log(`${colors.magenta}[${current}/${total}]${colors.reset} ${message}`);
  },

  agent: (agentName, message) => {
    console.log(`${colors.cyan}[${agentName}]${colors.reset} ${message}`);
  },

  memory: (type, message) => {
    console.log(`${colors.magenta}[Memory:${type}]${colors.reset} ${colors.dim}${message}${colors.reset}`);
  },

  tool: (toolName, status) => {
    const icon = status === "success" ? "✓" : status === "error" ? "✗" : "▶";
    const color = status === "success" ? colors.green : status === "error" ? colors.red : colors.blue;
    console.log(`${color}${icon} Tool: ${toolName}${colors.reset}`);
  }
};

export default log;

// Made with Bob
