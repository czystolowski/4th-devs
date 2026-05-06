/**
 * Agent logic for mailbox search and information extraction
 */

import { AI_API_KEY, RESPONSES_API_ENDPOINT, EXTRA_API_HEADERS, resolveModelForProvider } from "../../config.js";
import { api } from "./config.js";
import { getEmail, getMessages, searchEmails } from "./helpers/zmail.js";

/**
 * Call AI API with Responses API format
 */
const callAI = async (input, instructions = null, tools = null) => {
  const requestBody = {
    model: resolveModelForProvider(api.model),
    input,
    max_output_tokens: api.maxOutputTokens
  };

  if (instructions) {
    requestBody.instructions = instructions;
  }

  if (tools) {
    requestBody.tools = tools;
  }

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
 * Extract text from AI response
 */
const extractText = (response) => {
  const messageItem = response.output?.find(item => item.type === "message");
  return messageItem?.content?.[0]?.text || "";
};

/**
 * Extract tool calls from AI response
 */
const extractToolCalls = (response) => {
  const toolCallItems = response.output?.filter(item => item.type === "function_call") || [];
  return toolCallItems.map(item => ({
    name: item.name,
    arguments: item.arguments
  }));
};

/**
 * Search for emails from Wiktor (proton.me domain)
 */
export const searchWiktorEmails = async () => {
  // Search for emails from proton.me domain
  const result = await searchEmails("from:proton.me");
  return result;
};

/**
 * Get full content of multiple emails
 */
export const getEmailsContent = async (emailIds) => {
  const emails = [];
  
  for (const id of emailIds) {
    const email = await getEmail(id);
    emails.push(email);
  }
  
  return emails;
};

/**
 * Extract specific information from email content using AI
 */
export const extractInformation = async (emails, targetInfo) => {
  const emailsText = emails.map(email => {
    return `
EMAIL ID: ${email.id}
FROM: ${email.from}
TO: ${email.to}
SUBJECT: ${email.subject}
DATE: ${email.date}
BODY:
${email.body}
---
`;
  }).join("\n");

  const instructions = `You are an information extraction assistant. Extract specific information from emails.
Return ONLY a JSON object with the requested fields. If information is not found, use null.
Be precise and extract exact values as they appear in the emails.`;

  const input = `Extract the following information from these emails:
${targetInfo}

Emails:
${emailsText}

Return JSON with fields: password, date (YYYY-MM-DD format), confirmation_code (SEC- prefix + 32 chars)`;

  const response = await callAI(input, instructions);
  const text = extractText(response);
  
  // Try to parse JSON from response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // If parsing fails, return the raw text
  }
  
  return { raw: text };
};

/**
 * Agent loop with tools for searching and extracting information
 */
export const runAgent = async (objective) => {
  const tools = [
    {
      type: "function",
      name: "search_emails",
      description: "Search for emails using Gmail-like operators (from:, to:, subject:, OR, AND)",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query using operators like 'from:proton.me' or 'subject:security'"
          }
        },
        required: ["query"]
      }
    },
    {
      type: "function",
      name: "get_email_content",
      description: "Get full content of an email by its ID",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Email ID to retrieve"
          }
        },
        required: ["id"]
      }
    },
    {
      type: "function",
      name: "submit_answer",
      description: "Submit the final answer with password, date, and confirmation_code",
      parameters: {
        type: "object",
        properties: {
          password: {
            type: "string",
            description: "Password to employee system"
          },
          date: {
            type: "string",
            description: "Attack date in YYYY-MM-DD format"
          },
          confirmation_code: {
            type: "string",
            description: "Security ticket confirmation code (SEC- + 32 chars)"
          }
        },
        required: ["password", "date", "confirmation_code"]
      }
    }
  ];

  const instructions = `You are an email search agent. Your task is to find specific information from a mailbox.
Use the available tools to search emails and extract information.
Work step by step:
1. Search for emails from Wiktor (from:proton.me domain)
2. Get full content of relevant emails
3. Extract the three required pieces of information
4. Submit the answer when you have all three values

Be thorough and check multiple emails if needed.`;

  const conversationHistory = [];

  const MAX_ITERATIONS = 15;
  let iteration = 0;
  const emailCache = new Map();

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    
    // Build input from objective and conversation history
    const input = iteration === 1
      ? objective
      : `${objective}\n\nPrevious actions and results:\n${conversationHistory.join("\n\n")}`;
    
    const response = await callAI(input, instructions, tools);
    const text = extractText(response);
    const toolCalls = extractToolCalls(response);

    // If no tool calls, agent is done
    if (toolCalls.length === 0) {
      return { completed: false, finalMessage: text };
    }

    // Execute tool calls
    for (const toolCall of toolCalls) {
      let result;

      try {
        if (toolCall.name === "search_emails") {
          const searchResult = await searchEmails(toolCall.arguments.query);
          // Format items for agent (API returns items, not messages)
          const formatted = {
            found: searchResult.items?.length || 0,
            emails: searchResult.items?.map(item => ({
              id: item.rowID,
              from: item.from,
              to: item.to,
              subject: item.subject,
              date: item.date
            })) || []
          };
          result = JSON.stringify(formatted, null, 2);
          conversationHistory.push(`Searched: ${toolCall.arguments.query}\nResult: ${result}`);
        } else if (toolCall.name === "get_email_content") {
          const emailId = toolCall.arguments.id;
          
          // Use cache to avoid re-fetching
          if (!emailCache.has(emailId)) {
            const email = await getEmail(emailId);
            emailCache.set(emailId, email);
          }
          
          const email = emailCache.get(emailId);
          // Format email content (message field contains the body)
          const formatted = {
            id: email.rowID,
            from: email.from,
            to: email.to,
            subject: email.subject,
            date: email.date,
            body: email.message || email.body || ""
          };
          result = JSON.stringify(formatted, null, 2);
          conversationHistory.push(`Got email ${emailId}:\n${result}`);
        } else if (toolCall.name === "submit_answer") {
          return {
            completed: true,
            answer: toolCall.arguments
          };
        }
      } catch (error) {
        result = `Error: ${error.message}`;
        conversationHistory.push(`Error in ${toolCall.name}: ${result}`);
      }
    }
  }

  return { completed: false, finalMessage: "Max iterations reached" };
};

// Made with Bob
