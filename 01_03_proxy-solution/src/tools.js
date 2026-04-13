import { AGENT_TOKEN, PACKAGES_API_URL } from "./config.js";

/**
 * Tool definitions for OpenAI function calling
 */
export const tools = [
  {
    type: "function",
    name: "check_package",
    description: "Check the status and location of a package by its ID",
    parameters: {
      type: "object",
      properties: {
        packageid: {
          type: "string",
          description: "The package ID to check (e.g., PKG12345678)"
        }
      },
      required: ["packageid"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "redirect_package",
    description: "Redirect a package to a new destination. Requires security code.",
    parameters: {
      type: "object",
      properties: {
        packageid: {
          type: "string",
          description: "The package ID to redirect"
        },
        destination: {
          type: "string",
          description: "The destination code (e.g., PWR3847PL)"
        },
        code: {
          type: "string",
          description: "Security code for the redirect operation"
        }
      },
      required: ["packageid", "destination", "code"],
      additionalProperties: false
    },
    strict: true
  }
];

/**
 * Check package status via API
 */
export async function checkPackage(packageid) {
  const response = await fetch(PACKAGES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: AGENT_TOKEN,
      action: "check",
      packageid
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Package check failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Redirect package to new destination
 */
export async function redirectPackage(packageid, destination, code) {
  const response = await fetch(PACKAGES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: AGENT_TOKEN,
      action: "redirect",
      packageid,
      destination,
      code
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Package redirect failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Execute a tool call
 */
export async function executeTool(toolName, args) {
  console.log(`   🔧 Tool: ${toolName}`, JSON.stringify(args));

  try {
    let result;
    
    switch (toolName) {
      case "check_package":
        result = await checkPackage(args.packageid);
        break;
      
      case "redirect_package":
        result = await redirectPackage(args.packageid, args.destination, args.code);
        break;
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    console.log(`   ✓ Result:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error(`   ✗ Error:`, error.message);
    return { error: error.message };
  }
}


