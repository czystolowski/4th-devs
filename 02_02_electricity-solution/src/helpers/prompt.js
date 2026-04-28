/**
 * Interactive user prompts for decision confirmation
 */

import readline from "readline";

/**
 * Create readline interface for user input
 */
const createInterface = () => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
};

/**
 * Ask user a yes/no question
 */
export const askYesNo = (question) => {
  return new Promise((resolve) => {
    const rl = createInterface();
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
};

/**
 * Ask user to choose from options
 */
export const askChoice = (question, options) => {
  return new Promise((resolve) => {
    const rl = createInterface();
    console.log(`\n${question}`);
    options.forEach((opt, idx) => {
      console.log(`  ${idx + 1}. ${opt}`);
    });
    rl.question('\nYour choice (number): ', (answer) => {
      rl.close();
      const choice = parseInt(answer) - 1;
      if (choice >= 0 && choice < options.length) {
        resolve(choice);
      } else {
        resolve(0); // Default to first option
      }
    });
  });
};

/**
 * Ask user for text input
 */
export const askText = (question) => {
  return new Promise((resolve) => {
    const rl = createInterface();
    rl.question(`${question}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

/**
 * Wait for user to press Enter
 */
export const waitForEnter = (message = "Press Enter to continue...") => {
  return new Promise((resolve) => {
    const rl = createInterface();
    rl.question(`\n${message}`, () => {
      rl.close();
      resolve();
    });
  });
};

// Made with Bob
