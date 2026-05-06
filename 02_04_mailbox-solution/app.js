/**
 * Mailbox Search Solution - Agentic Approach with Polling
 *
 * Solves the mailbox challenge by:
 * 1. Exploring ZMail API capabilities
 * 2. Polling for emails from Wiktor (proton.me domain)
 * 3. Using AI agent to extract password, attack date, and confirmation code
 * 4. Submitting answer to hub for verification
 */

import { getHelp, verifyAnswer, searchEmails, callZMailAPI } from "./src/helpers/zmail.js";
import { runAgent } from "./src/agent.js";
import log from "./src/helpers/logger.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
  log.box("Mailbox Search\nAI Agent Email Investigation\nFind Wiktor's Messages");
  
  try {
    // Step 1: Explore API capabilities
    log.start("Exploring ZMail API capabilities...");
    const helpInfo = await getHelp();
    log.success("API capabilities retrieved");
    log.info(`Available actions: ${Object.keys(helpInfo.actions || {}).join(", ")}`);
    console.log("");
    
    // Step 2: Poll for messages (check all pages)
    const MAX_POLL_ATTEMPTS = 20;
    const POLL_INTERVAL = 10000; // 10 seconds to avoid rate limits
    let messagesFound = false;
    
    log.start("Polling mailbox for messages (checking all pages)...");
    
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      log.step(attempt, MAX_POLL_ATTEMPTS, "Checking for emails from proton.me...");
      
      try {
        // Primary search: from:proton.me (checks all pages)
        const result = await searchEmails("from:proton.me", 10);
        
        // API returns 'items' not 'messages'
        if (result.items && result.items.length > 0) {
          log.success(`Found ${result.items.length} messages from proton.me (across all pages)`);
          messagesFound = true;
          break;
        }
        
        log.info("No messages yet from proton.me");
        
      } catch (error) {
        if (error.message.includes("429")) {
          log.warning("Rate limit hit, waiting 30 seconds...");
          await sleep(30000);
          continue;
        }
        throw error;
      }
      
      if (attempt < MAX_POLL_ATTEMPTS) {
        log.info(`Waiting ${POLL_INTERVAL / 1000} seconds before next check...`);
        await sleep(POLL_INTERVAL);
      }
    }
    
    if (!messagesFound) {
      log.error("No messages found", "Mailbox remained empty after polling");
      log.info("The mailbox may be inactive or messages haven't arrived yet");
      return;
    }
    
    console.log("");
    
    // Step 3: Run agent to search and extract information
    log.start("Starting AI agent to extract information...");
    
    const objective = `Find three pieces of information from emails sent by Wiktor (from proton.me domain):
1. password - password to employee system
2. date - date when security department plans attack on power plant (YYYY-MM-DD format)
3. confirmation_code - security ticket confirmation code (format: SEC- + 32 characters = 36 total)

Search for emails from:proton.me and extract this information from the email content.
If you can't find emails from proton.me, try searching for "Wiktor" or "security" or "password".`;

    const result = await runAgent(objective);
    
    if (!result.completed) {
      log.error("Agent did not complete", result.finalMessage);
      
      // Fallback: try direct extraction without agent
      log.warning("Attempting direct extraction as fallback...");
      const fallbackAnswer = await directExtraction();
      
      if (fallbackAnswer.password && fallbackAnswer.date && fallbackAnswer.confirmation_code) {
        log.success("Direct extraction successful");
        log.data("Password", fallbackAnswer.password);
        log.data("Date", fallbackAnswer.date);
        log.data("Confirmation Code", fallbackAnswer.confirmation_code);
        console.log("");
        
        log.start("Verifying answer with hub...");
        const verification = await verifyAnswer(fallbackAnswer);
        
        if (verification.flag) {
          log.flag(verification.flag);
          console.log("✓ Challenge solved successfully!");
        } else {
          log.warning("Verification response:");
          console.log(JSON.stringify(verification, null, 2));
        }
      } else {
        log.error("Fallback extraction incomplete");
      }
      
      return;
    }
    
    log.success("Agent found all required information");
    log.data("Password", result.answer.password || "NOT FOUND");
    log.data("Date", result.answer.date || "NOT FOUND");
    log.data("Confirmation Code", result.answer.confirmation_code || "NOT FOUND");
    console.log("");
    
    // Step 4: Verify answer with hub
    log.start("Verifying answer with hub...");
    const verification = await verifyAnswer(result.answer);
    
    if (verification.flag) {
      log.flag(verification.flag);
      console.log("✓ Challenge solved successfully!");
    } else {
      log.warning("Verification response:");
      console.log(JSON.stringify(verification, null, 2));
      
      if (verification.message) {
        log.info(`Feedback: ${verification.message}`);
      }
    }
    
  } catch (error) {
    log.error("Error", error.message);
    console.error(error);
    process.exit(1);
  }
};

/**
 * Direct extraction fallback when agent fails
 */
const directExtraction = async () => {
  const answer = {
    password: null,
    date: null,
    confirmation_code: null
  };
  
  try {
    // Search for all relevant messages (check all pages)
    log.info("Searching all pages for relevant messages...");
    const result = await searchEmails("from:proton.me", 10);
    const allMessages = [];
    
    // API returns 'items' not 'messages'
    if (result.items && result.items.length > 0) {
      const messageIds = result.items.map(m => m.rowID);
      const messagesResult = await callZMailAPI("getMessages", { ids: messageIds });
      // getMessages returns items with 'message' field containing content
      if (messagesResult.items) {
        allMessages.push(...messagesResult.items);
      }
    }
    
    // Remove duplicates
    const uniqueMessages = Array.from(
      new Map(allMessages.map(m => [m.rowID, m])).values()
    );
    
    // Extract information
    for (const msg of uniqueMessages) {
      const body = msg.message || msg.body || "";
      const subject = msg.subject || "";
      const combined = subject + "\n" + body;
      
      // Look for password
      if (!answer.password) {
        const passwordMatch = combined.match(/(?:password|hasło|pass|pwd)[\s:=]+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+)/i);
        if (passwordMatch) {
          answer.password = passwordMatch[1].trim();
        }
      }
      
      // Look for date
      if (!answer.date) {
        const dateMatch = combined.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
        if (dateMatch) {
          answer.date = dateMatch[1];
        }
      }
      
      // Look for confirmation code
      if (!answer.confirmation_code) {
        const codeMatch = combined.match(/\b(SEC-[A-Za-z0-9]{32})\b/);
        if (codeMatch) {
          answer.confirmation_code = codeMatch[1];
        }
      }
    }
  } catch (error) {
    log.error("Direct extraction error", error.message);
  }
  
  return answer;
};

main().catch((err) => {
  log.error("Startup error", err.message);
  process.exit(1);
});

// Made with Bob
