/**
 * Mailbox Search Solution - Simple Direct Approach
 * 
 * Directly searches for emails and extracts information without AI agent
 */

import { searchEmails, callZMailAPI, verifyAnswer, getInbox } from "./src/helpers/zmail.js";
import log from "./src/helpers/logger.js";

const main = async () => {
  log.box("Mailbox Search\nDirect Email Investigation\nFind Wiktor's Messages");
  
  try {
    // Step 1: Check inbox first
    log.start("Checking inbox...");
    const inboxResult = await getInbox(1);
    log.success(`Inbox has ${inboxResult.threads?.length || 0} threads`);
    
    if (inboxResult.threads && inboxResult.threads.length > 0) {
      console.log("\nRecent threads:");
      inboxResult.threads.slice(0, 5).forEach(thread => {
        log.info(`Thread ${thread.threadID}: ${thread.subject} (${thread.messageCount} messages)`);
      });
      console.log("");
    }
    
    // Step 2: Search for emails from proton.me
    log.start("Searching for emails from proton.me...");
    let searchResult = await searchEmails("from:proton.me");
    log.info(`Found ${searchResult.messages?.length || 0} messages from proton.me`);
    
    // If no results, try broader search
    if (!searchResult.messages || searchResult.messages.length === 0) {
      log.info("Trying broader search for 'Wiktor'...");
      searchResult = await searchEmails("Wiktor");
      log.info(`Found ${searchResult.messages?.length || 0} messages mentioning Wiktor`);
    }
    
    // If still no results, search for security-related emails
    if (!searchResult.messages || searchResult.messages.length === 0) {
      log.info("Trying search for 'security' or 'SEC-'...");
      searchResult = await searchEmails("security OR SEC-");
      log.info(`Found ${searchResult.messages?.length || 0} security-related messages`);
    }
    
    if (!searchResult.messages || searchResult.messages.length === 0) {
      log.warning("No relevant messages found yet.");
      log.info("The mailbox is active - messages may arrive soon. Try running again.");
      return;
    }
    
    console.log("\nMessages found:");
    searchResult.messages.forEach(msg => {
      log.info(`ID: ${msg.rowID} - From: ${msg.from} - Subject: ${msg.subject}`);
    });
    console.log("");
    
    // Step 3: Get full content of all messages
    log.start("Fetching full content of messages...");
    const messageIds = searchResult.messages.map(m => m.rowID);
    const messagesResult = await callZMailAPI("getMessages", { ids: messageIds });
    log.success(`Retrieved ${messagesResult.messages?.length || 0} full messages`);
    console.log("");
    
    // Step 4: Extract information from messages
    const answer = {
      password: null,
      date: null,
      confirmation_code: null
    };
    
    log.start("Extracting information from messages...");
    
    for (const msg of messagesResult.messages) {
      const body = msg.body || "";
      const subject = msg.subject || "";
      const combined = subject + "\n" + body;
      
      log.info(`\nAnalyzing message from ${msg.from}:`);
      log.info(`Subject: ${subject}`);
      
      // Look for password - various patterns
      if (!answer.password) {
        const patterns = [
          /(?:password|hasło|pass|pwd)[\s:=]+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+)/i,
          /(?:credentials|login)[\s:]+\w+[\s\/]+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+)/i
        ];
        
        for (const pattern of patterns) {
          const match = combined.match(pattern);
          if (match) {
            answer.password = match[1].trim();
            log.data("Found password", answer.password);
            break;
          }
        }
      }
      
      // Look for date in YYYY-MM-DD format
      if (!answer.date) {
        const dateMatch = combined.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
        if (dateMatch) {
          answer.date = dateMatch[1];
          log.data("Found date", answer.date);
        }
      }
      
      // Look for confirmation code (SEC- + 32 chars)
      if (!answer.confirmation_code) {
        const codeMatch = combined.match(/\b(SEC-[A-Za-z0-9]{32})\b/);
        if (codeMatch) {
          answer.confirmation_code = codeMatch[1];
          log.data("Found confirmation code", answer.confirmation_code);
        }
      }
      
      // Show snippet of body for debugging
      if (body.length > 0) {
        log.info(`Body snippet: ${body.substring(0, 300)}...`);
      }
    }
    
    console.log("\n");
    log.info("Extracted information:");
    log.data("Password", answer.password || "NOT FOUND");
    log.data("Date", answer.date || "NOT FOUND");
    log.data("Confirmation Code", answer.confirmation_code || "NOT FOUND");
    console.log("");
    
    // Step 5: Verify answer
    if (answer.password && answer.date && answer.confirmation_code) {
      log.start("Verifying answer with hub...");
      const verification = await verifyAnswer(answer);
      
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
    } else {
      log.warning("Not all information found yet. Missing:");
      if (!answer.password) log.info("- password");
      if (!answer.date) log.info("- date");
      if (!answer.confirmation_code) log.info("- confirmation_code");
      
      log.info("\nThe mailbox is active - new emails may arrive. Try running again in a moment.");
    }
    
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

// Made with Bob
