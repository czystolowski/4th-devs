import { chat, extractToolCalls, extractContent } from './helpers/api.js';
import { executeShellCommand, submitAnswer } from './helpers/shell.js';

const SYSTEM_PROMPT = `You are a Linux system administrator debugging firmware on a virtual machine.

Your task:
1. Run /opt/firmware/cooler/cooler.bin to start the cooling system
2. Find the password needed to run the binary (it's stored somewhere in the system)
3. Configure settings.ini properly so the system works
4. Extract the ECCS code (format: ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)

CRITICAL Security rules:
- DO NOT access /etc, /root, or /proc directories
- MUST check .gitignore file FIRST and respect it - don't touch blacklisted files/directories
- Files like .env, storage.cfg, logs/ are typically blacklisted
- If banned, the VM resets and you lose ALL progress

Available shell commands (use 'help' to see full list):
- ls, cat, cd, pwd, rm, editline, reboot, date, uptime, find, history, whoami

Strategy:
1. FIRST: Read .gitignore to know what NOT to touch
2. List /opt/firmware/cooler directory to see available files
3. Read settings.ini and configure it (uncomment SAFETY_CHECK, enable cooling)
4. Search for password in ALLOWED locations only (not in blacklisted files)
5. Try common password locations: /home, /var, /tmp, /opt (but not blacklisted subdirs)
6. Use find command to search for password files
7. Once you have password, run: /opt/firmware/cooler/cooler.bin <password>
8. Extract ECCS code from output

IMPORTANT:
- Don't waste iterations waiting for bans - if banned, reboot immediately
- Don't try to access .env, storage.cfg, or logs/ directory
- Password is likely in a readable file outside the blacklist`;

const tools = [
  {
    type: 'function',
    function: {
      name: 'execute_shell',
      description: 'Execute a shell command on the virtual machine. Returns the command output or error message.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute (e.g., "ls -la /opt/firmware")',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_code',
      description: 'Submit the ECCS confirmation code to complete the task. Only use when you have found the code.',
      parameters: {
        type: 'object',
        properties: {
          confirmation: {
            type: 'string',
            description: 'The ECCS code in format: ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          },
        },
        required: ['confirmation'],
      },
    },
  },
];

export async function runAgent() {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: 'Start debugging the firmware. Begin by exploring the system and finding what you need to run the cooler.bin successfully.' },
  ];

  let iterations = 0;
  const maxIterations = 50;

  while (iterations < maxIterations) {
    iterations++;
    console.log(`\n=== Iteration ${iterations} ===`);

    const response = await chat(messages, 'gpt-4o', tools, null, 4096);
    const assistantMessage = response.choices[0].message;
    
    messages.push(assistantMessage);

    // Check if agent wants to use tools
    const toolCalls = extractToolCalls(response);
    
    if (toolCalls.length === 0) {
      // No tool calls, agent is done or providing explanation
      const content = extractContent(response);
      console.log('Agent:', content);
      
      if (content && content.toLowerCase().includes('task complete')) {
        break;
      }
      
      // Ask agent to continue
      messages.push({
        role: 'user',
        content: 'Continue with the next step.',
      });
      continue;
    }

    // Process tool calls
    const toolResults = [];
    
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      console.log(`Tool: ${functionName}`);
      console.log(`Args:`, args);

      let result;
      
      try {
        if (functionName === 'execute_shell') {
          const shellResult = await executeShellCommand(args.command);
          result = JSON.stringify(shellResult, null, 2);
          console.log('Result:', result);
        } else if (functionName === 'submit_code') {
          const submitResult = await submitAnswer({ confirmation: args.confirmation });
          result = JSON.stringify(submitResult, null, 2);
          console.log('Submit result:', result);
          
          // If submission successful, we're done
          if (submitResult.code === 0) {
            console.log('\n✅ Task completed successfully!');
            return submitResult;
          }
        }
      } catch (error) {
        result = `Error: ${error.message}`;
        console.log('Error:', error.message);
      }

      toolResults.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Add tool results to conversation
    messages.push(...toolResults);
  }

  if (iterations >= maxIterations) {
    throw new Error('Max iterations reached without completing task');
  }
}


