/**
 * Mailbox Search Solution - Polling Version
 * 
 * Polls the mailbox periodically until messages arrive
 */

import { searchEmails, callZMailAPI, verifyAnswer, getInbox } from "./src/helpers/zmail.js";
import log from "./src/helpers/logger.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const extractInformation = (messages) => {
  const answer = {
    password: null,
    date: null,
    confirmation_code: null
  };
  
  for (const msg of messages) {
    const body = msg.body || "";
    const subject = msg.subject || "";
    const combined = subject + "\n" + body;
    
    // Look for password
    if (!answer.password) {
      const patterns = [
        /(?:password|hasło|pass|pwd)[\s:=]+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+)/i,
        /(?:credentials|login)[\s:]+\w+[\s\/]+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+)/i
      ];
      
      for (const pattern of patterns) {
        const match = combined.match(pattern);
        if (match) {
          answer.password = match[1].trim();
          break;
        }
      }
    }
    
    // Look for date in YYYY-MM-DD format
    if (!answer.date) {
      const dateMatch = combined.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      if (dateMatch) {
        answer.date = dateMatch[1];
      }
    }
    
    // Look for confirmation code (SEC- + 32 chars)
    if (!answer.confirmation_code) {
      const codeMatch = combined.match(/\b(SEC-[A-Za-z0-9]{32})\b/);
      if (codeMatch) {
        answer.confirmation_code = codeMatch[1];
      }
    }
  }
  
  return answer;
};

const main = async () => {
  log.box("Mailbox Search - Polling Mode\nWaiting for Wiktor's Messages");
  
  const MAX_ATTEMPTS = 30;
  const POLL_INTERVAL = 5000; // 5 seconds
  
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      log.step(attempt, MAX_ATTEMPTS, "Checking mailbox...");
      
      // Try multiple search strategies
      const searches = [
        { query: "from:proton.me", desc: "from proton.me" },
        { query: "Wiktor", desc: "mentioning Wiktor" },
        { query: "security OR SEC-", desc: "security-related" },
        { query: "password", desc: "containing password" }
      ];
      
      let allMessages = [];
      
      for (const search of searches) {
        const result = await searchEmails(search.query);
        if (result.messages && result.messages.length > 0) {
          log.success(`Found ${result.messages.length} messages ${search.desc}`);
          
          // Get full content
          const messageIds = result.messages.map(m => m.rowID);
          const messagesResult = await callZMailAPI("getMessages", { ids: messageIds });
          
          if (messagesResult.messages) {
            allMessages.push(...messagesResult.messages);
          }
        }
      }
      
      if (allMessages.length > 0) {
        // Remove duplicates
        const uniqueMessages = Array.from(
          new Map(allMessages.map(m => [m.rowID, m])).values()
        );
        
        log.success(`Total unique messages: ${uniqueMessages.length}`);
        console.log("");
        
        // Extract information
        const answer = extractInformation(uniqueMessages);
        
        log.info("Extracted information:");
        log.data("Password", answer.password || "NOT FOUND");
        log.data("Date", answer.date || "NOT FOUND");
        log.data("Confirmation Code", answer.confirmation_code || "NOT FOUND");
        console.log("");
        
        // If we have all three, verify
        if (answer.password && answer.date && answer.confirmation_code) {
          log.start("Verifying answer with hub...");
          const verification = await verifyAnswer(answer);
          
          if (verification.flag) {
            log.flag(verification.flag);
            console.log("✓ Challenge solved successfully!");
            return;
          } else {
            log.warning("Verification failed:");
            console.log(JSON.stringify(verification, null, 2));
            
            if (verification.message) {
              log.info(`Feedback: ${verification.message}`);
            }
          }
        } else {
          log.warning("Not all information found yet. Continuing to poll...");
        }
      } else {
        log.info("No messages yet. Waiting...");
      }
      
      if (attempt < MAX_ATTEMPTS) {
        await sleep(POLL_INTERVAL);
      }
    }
    
    log.error("Max attempts reached", "Messages did not arrive in time");
    
  } catch (error) {
    log.error("Error", error.message);
    console.error(error);
    process.exit(1);
  }
};

main().catch((err) => {
  log.error("Startup error", err.message);
  process.exit(1);
});

