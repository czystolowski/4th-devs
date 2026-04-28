/**
 * Logging utilities for consistent output formatting
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
    const width = 50;
    const lines = title.split("\n");
    console.log("\n" + "═".repeat(width));
    lines.forEach(line => {
      const padding = Math.max(0, width - line.length - 2);
      console.log(`║ ${line}${" ".repeat(padding)}║`);
    });
    console.log("═".repeat(width) + "\n");
  },

  start: (message) => {
    console.log(`${colors.blue}▶${colors.reset} ${message}`);
  },

  success: (message) => {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
  },

  error: (title, message) => {
    console.log(`${colors.red}✗ ${title}${colors.reset}`);
    if (message) console.log(`  ${message}`);
  },

  warning: (message) => {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
  },

  info: (message) => {
    console.log(`${colors.cyan}ℹ${colors.reset} ${message}`);
  },

  step: (step, total, message) => {
    console.log(`${colors.magenta}[${step}/${total}]${colors.reset} ${message}`);
  },

  grid: (title, gridData) => {
    console.log(`\n${colors.bright}${title}${colors.reset}`);
    console.log("─".repeat(40));
    for (let row = 0; row < 3; row++) {
      const cells = [];
      for (let col = 0; col < 3; col++) {
        const pos = `${row + 1}x${col + 1}`;
        const cell = gridData[pos] || "?";
        cells.push(cell.padEnd(10));
      }
      console.log(cells.join(" | "));
      if (row < 2) console.log("─".repeat(40));
    }
    console.log("─".repeat(40) + "\n");
  },

  rotation: (position, rotations) => {
    console.log(`${colors.yellow}↻${colors.reset} Rotating ${position} (${rotations} times)`);
  },

  flag: (flag) => {
    console.log(`\n${colors.green}${colors.bright}🎉 FLAG RECEIVED: ${flag}${colors.reset}\n`);
  }
};

export default log;

