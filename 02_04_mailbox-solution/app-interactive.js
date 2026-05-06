/**
 * Mailbox Search Solution - Interactive Agent with Persistent Session
 *
 * This implementation treats the mailbox as an interactive system where:
 * - New messages arrive as we interact with it
 * - The agent maintains a persistent session
 * - Each action may trigger new messages to appear
 * - Similar to a conversation where we wait for responses
 */

import { callZMailAPI, verifyAnswer } from "./src/helpers/zmail.js";
import { AI_API_KEY, RESPONSES_API_ENDPOINT, EXTRA_API_HEADERS, resolveModelForProvider } from "../config.js";
import { api } from "./src/config.js";
import log from "./src/helpers/logger.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Call AI with Responses API
 */
const callAI = async (input, instructions, tools) => {
  const requestBody = {
    model: resolveModelForProvider(api.model),
    input,
    instructions,
    max_output_tokens: api.maxOutputTokens,
    tools
  };

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} ${errorText}`);
  }

  return response.json();
};

/**
 * Extract text and tool calls from response
 */
const extractFromResponse = (response) => {
  const text = response.output?.find(item => item.type === "message")?.content?.[0]?.text || "";
  const toolCalls = response.output?.filter(item => item.type === "function_call").map(item => ({
    name: item.name,
    arguments: item.arguments
  })) || [];
  
  return { text, toolCalls };
};

/**
 * Interactive agent that maintains session with mailbox
 */
const runInteractiveAgent = async () => {
  log.box("Interactive Mailbox Agent\nPersistent Session Mode\nWaiting for Server Responses");
  
  // Define tools for the agent
  const tools = [
    {
      type: "function",
      name: "search_emails",
      description: "Search for emails. After searching, wait for the mailbox to respond - new messages may appear.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (e.g., 'from:proton.me', 'Wiktor', 'security')"
          }
        },
        required: ["query"]
      }
    },
    {
      type: "function",
      name: "get_messages",
      description: "Get full content of messages by their IDs. This may trigger new messages to arrive.",
      parameters: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of message IDs (rowID) to retrieve"
          }
        },
        required: ["ids"]
      }
    },
    {
      type: "function",
      name: "wait_and_check",
      description: "Wait for the mailbox to respond and check for new messages. Use this after each action.",
      parameters: {
        type: "object",
        properties: {
          seconds: {
            type: "number",
            description: "Seconds to wait (default 5)"
          }
        }
      }
    },
    {
      type: "function",
      name: "submit_answer",
      description: "Submit the final answer when you have all three pieces of information",
      parameters: {
        type: "object",
        properties: {
          password: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD format" },
          confirmation_code: { type: "string", description: "SEC- + 32 chars" }
        },
        required: ["password", "date", "confirmation_code"]
      }
    }
  ];

  const instructions = `You are an interactive email agent working with a LIVE mailbox system.

IMPORTANT: This mailbox is INTERACTIVE - new messages arrive as you interact with it!

Your task:
1. Search for emails from Wiktor (from:proton.me domain)
2. Read the messages - this may trigger NEW messages to arrive
3. After EACH action, wait and check again for new messages
4. Extract three pieces of information:
   - password: password to employee system
   - date: attack date (YYYY-MM-DD format)
   - confirmation_code: security ticket code (SEC- + 32 chars)

Strategy:
- Start by searching for emails from:proton.me
- Read any messages you find
- WAIT after reading - new messages may appear
- Check again for new messages
- Keep checking until you have all three pieces of information
- The mailbox responds to your actions - be patient!`;

  const conversationHistory = [];
  const MAX_ITERATIONS = 30;
  let iteration = 0;
  
  const objective = `Find three pieces of information from Wiktor's emails:
1. password - password to employee system
2. date - attack date on power plant (YYYY-MM-DD format)  
3. confirmation_code - security ticket confirmation code (SEC- + 32 chars)

Remember: This is an INTERACTIVE mailbox. New messages arrive as you interact with it!`;

  log.start("Starting interactive agent session...");
  console.log("");

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    log.step(iteration, MAX_ITERATIONS, "Agent thinking...");
    
    try {
      // Build input with conversation history
      const input = iteration === 1
        ? objective
        : `${objective}\n\nConversation history:\n${conversationHistory.slice(-10).join("\n\n")}`;
      
      const response = await callAI(input, instructions, tools);
      const { text, toolCalls } = extractFromResponse(response);
      
      if (text) {
        log.info(`Agent: ${text}`);
        conversationHistory.push(`Agent: ${text}`);
      }
      
      if (toolCalls.length === 0) {
        log.warning("Agent stopped without tool calls");
        break;
      }
      
      // Execute tool calls
      for (const toolCall of toolCalls) {
        log.info(`Tool: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
        
        try {
          let result;
          
          if (toolCall.name === "search_emails") {
            const searchResult = await callZMailAPI("search", {
              query: toolCall.arguments.query,
              page: 1
            });
            // API returns 'items' not 'messages'
            result = `Found ${searchResult.items?.length || 0} messages`;
            if (searchResult.items && searchResult.items.length > 0) {
              result += `:\n${searchResult.items.map(m =>
                `- ID: ${m.rowID}, From: ${m.from}, Subject: ${m.subject}`
              ).join("\n")}`;
            }
            log.success(result);
            conversationHistory.push(`Search result: ${result}`);
            
          } else if (toolCall.name === "get_messages") {
            const ids = toolCall.arguments.ids;
            const messagesResult = await callZMailAPI("getMessages", { ids });
            
            // API returns 'items' with 'message' field containing content
            if (messagesResult.items) {
              result = `Retrieved ${messagesResult.items.length} messages:\n`;
              for (const msg of messagesResult.items) {
                const body = msg.message || msg.body || "";
                result += `\nMessage ${msg.rowID}:\nFrom: ${msg.from}\nSubject: ${msg.subject}\nBody: ${body}\n`;
              }
              log.success(`Retrieved ${messagesResult.items.length} messages`);
              conversationHistory.push(`Messages: ${result}`);
            }
            
          } else if (toolCall.name === "wait_and_check") {
            const seconds = toolCall.arguments.seconds || 5;
            log.info(`Waiting ${seconds} seconds for mailbox to respond...`);
            await sleep(seconds * 1000);
            
            // Check for new messages
            const checkResult = await callZMailAPI("search", {
              query: "from:proton.me",
              page: 1
            });
            // API returns 'items' not 'messages'
            result = `After waiting: ${checkResult.items?.length || 0} messages from proton.me`;
            log.info(result);
            conversationHistory.push(result);
            
          } else if (toolCall.name === "submit_answer") {
            log.success("Agent submitting answer!");
            log.data("Password", toolCall.arguments.password);
            log.data("Date", toolCall.arguments.date);
            log.data("Confirmation Code", toolCall.arguments.confirmation_code);
            console.log("");
            
            log.start("Verifying with hub...");
            const verification = await verifyAnswer(toolCall.arguments);
            
            if (verification.flag) {
              log.flag(verification.flag);
              console.log("✓ Challenge solved successfully!");
              return { success: true, flag: verification.flag };
            } else {
              log.warning("Verification failed:");
              console.log(JSON.stringify(verification, null, 2));
              conversationHistory.push(`Verification failed: ${verification.message || "Unknown error"}`);
            }
          }
          
        } catch (error) {
          const errorMsg = `Error in ${toolCall.name}: ${error.message}`;
          log.error("Tool error", errorMsg);
          conversationHistory.push(errorMsg);
        }
      }
      
      console.log("");
      
    } catch (error) {
      log.error("Iteration error", error.message);
      if (error.message.includes("429")) {
        log.warning("Rate limit hit, waiting 30 seconds...");
        await sleep(30000);
      } else if (error.message.includes("403")) {
        log.error("API key limit exceeded", "Cannot continue");
        break;
      } else {
        throw error;
      }
    }
  }
  
  log.warning("Agent session ended");
  return { success: false };
};

// Run the interactive agent
runInteractiveAgent().catch(err => {
  log.error("Fatal error", err.message);
  console.error(err);
  process.exit(1);
});

// Made with Bob
