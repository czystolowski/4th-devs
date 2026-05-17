/**
 * Documentation Agent Tools
 * Tools for fetching and parsing API documentation
 */

import { createToolDefinition, toolRegistry } from "../core/tools.js";
import { hub } from "../config.js";
import log from "../helpers/logger.js";

/**
 * Fetch HTML documentation from hub
 */
async function fetchDocumentation(args, context) {
  const { url } = args;
  
  const docUrl = url || `${hub.baseUrl}/dane/drone.html`;
  
  log.info(`Fetching documentation from ${docUrl}`);
  
  const response = await fetch(docUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch documentation: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  
  log.info(`Documentation fetched: ${html.length} characters`);
  
  return {
    success: true,
    html,
    url: docUrl,
    length: html.length
  };
}

/**
 * Parse HTML to extract structured data
 */
async function parseHtml(args, context) {
  const { html, extractType = "all" } = args;
  
  if (!html) {
    throw new Error("HTML content is required");
  }
  
  log.info(`Parsing HTML (${html.length} chars) for type: ${extractType}`);
  
  const result = {
    success: true,
    extractType
  };
  
  // Extract headings
  if (extractType === "all" || extractType === "headings") {
    const headingMatches = html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi);
    result.headings = Array.from(headingMatches).map(match => ({
      level: parseInt(match[1]),
      text: match[2].replace(/<[^>]*>/g, '').trim()
    }));
  }
  
  // Extract code blocks
  if (extractType === "all" || extractType === "code") {
    const codeMatches = html.matchAll(/<code[^>]*>(.*?)<\/code>/gis);
    result.codeBlocks = Array.from(codeMatches).map(match => 
      match[1].replace(/<[^>]*>/g, '').trim()
    );
  }
  
  // Extract pre blocks (often contain examples)
  if (extractType === "all" || extractType === "examples") {
    const preMatches = html.matchAll(/<pre[^>]*>(.*?)<\/pre>/gis);
    result.examples = Array.from(preMatches).map(match => 
      match[1].replace(/<[^>]*>/g, '').trim()
    );
  }
  
  // Extract paragraphs
  if (extractType === "all" || extractType === "paragraphs") {
    const paraMatches = html.matchAll(/<p[^>]*>(.*?)<\/p>/gis);
    result.paragraphs = Array.from(paraMatches).map(match => 
      match[1].replace(/<[^>]*>/g, '').trim()
    ).filter(p => p.length > 0);
  }
  
  // Extract lists
  if (extractType === "all" || extractType === "lists") {
    const listMatches = html.matchAll(/<li[^>]*>(.*?)<\/li>/gis);
    result.listItems = Array.from(listMatches).map(match => 
      match[1].replace(/<[^>]*>/g, '').trim()
    );
  }
  
  // Extract tables
  if (extractType === "all" || extractType === "tables") {
    const tableMatches = html.matchAll(/<table[^>]*>(.*?)<\/table>/gis);
    result.tables = Array.from(tableMatches).map(match => {
      const rows = match[1].matchAll(/<tr[^>]*>(.*?)<\/tr>/gis);
      return Array.from(rows).map(row => {
        const cells = row[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis);
        return Array.from(cells).map(cell => 
          cell[1].replace(/<[^>]*>/g, '').trim()
        );
      });
    });
  }
  
  log.info(`Parsed HTML: found ${Object.keys(result).length - 2} data types`);
  
  return result;
}

/**
 * Extract all API functions from documentation
 */
async function extractFunctions(args, context) {
  const { html } = args;
  
  if (!html) {
    throw new Error("HTML content is required");
  }
  
  log.info("Extracting API functions from documentation");
  
  const functions = [];
  
  // Look for function patterns in code blocks and text
  // Pattern 1: functionName(param1, param2)
  const functionPattern1 = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;
  
  // Pattern 2: Look in code blocks specifically
  const codeBlocks = html.matchAll(/<code[^>]*>(.*?)<\/code>/gis);
  const preBlocks = html.matchAll(/<pre[^>]*>(.*?)<\/pre>/gis);
  
  const allCodeContent = [
    ...Array.from(codeBlocks).map(m => m[1]),
    ...Array.from(preBlocks).map(m => m[1])
  ].join('\n');
  
  // Extract function calls from code content
  const matches = allCodeContent.matchAll(functionPattern1);
  const seen = new Set();
  
  for (const match of matches) {
    const funcName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(p => p);
    
    // Skip common keywords
    if (['if', 'for', 'while', 'function', 'return', 'var', 'let', 'const'].includes(funcName)) {
      continue;
    }
    
    const signature = `${funcName}(${params.join(', ')})`;
    
    if (!seen.has(signature)) {
      seen.add(signature);
      functions.push({
        name: funcName,
        parameters: params,
        signature,
        parameterCount: params.length
      });
    }
  }
  
  // Also look for function definitions in text
  const textContent = html.replace(/<[^>]*>/g, ' ');
  const functionDescPattern = /(?:function|method|command)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const descMatches = textContent.matchAll(functionDescPattern);
  
  for (const match of descMatches) {
    const funcName = match[1];
    if (!functions.some(f => f.name === funcName)) {
      functions.push({
        name: funcName,
        parameters: [],
        signature: `${funcName}()`,
        parameterCount: 0,
        fromDescription: true
      });
    }
  }
  
  log.info(`Extracted ${functions.length} API functions`);
  
  return {
    success: true,
    functions,
    count: functions.length
  };
}

/**
 * Understand parameter requirements for functions
 */
async function understandParameters(args, context) {
  const { html, functionName } = args;
  
  if (!html) {
    throw new Error("HTML content is required");
  }
  
  log.info(`Analyzing parameters${functionName ? ` for ${functionName}` : ''}`);
  
  // Extract text content
  const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  
  const parameterInfo = {
    success: true,
    functions: []
  };
  
  // If specific function requested, focus on that
  if (functionName) {
    // Find context around the function name
    const contextPattern = new RegExp(
      `(.{0,200})${functionName}(.{0,200})`,
      'gi'
    );
    const matches = textContent.matchAll(contextPattern);
    
    const contexts = Array.from(matches).map(m => m[0]);
    
    parameterInfo.functions.push({
      name: functionName,
      contexts,
      parameterHints: extractParameterHints(contexts.join(' '))
    });
  } else {
    // Extract all function parameter information
    const codeBlocks = html.matchAll(/<(?:code|pre)[^>]*>(.*?)<\/(?:code|pre)>/gis);
    const allCode = Array.from(codeBlocks).map(m => m[1]).join('\n');
    
    // Find function patterns with parameters
    const funcPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)/g;
    const matches = allCode.matchAll(funcPattern);
    
    const seen = new Set();
    for (const match of matches) {
      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);
      
      // Find context in full text
      const contextPattern = new RegExp(
        `(.{0,150})${name}(.{0,150})`,
        'gi'
      );
      const contextMatches = textContent.matchAll(contextPattern);
      const contexts = Array.from(contextMatches).map(m => m[0]);
      
      parameterInfo.functions.push({
        name,
        contexts,
        parameterHints: extractParameterHints(contexts.join(' '))
      });
    }
  }
  
  log.info(`Analyzed parameters for ${parameterInfo.functions.length} functions`);
  
  return parameterInfo;
}

/**
 * Helper to extract parameter hints from text
 */
function extractParameterHints(text) {
  const hints = {
    required: [],
    optional: [],
    types: {},
    formats: {},
    descriptions: {}
  };
  
  // Look for parameter descriptions
  const paramPattern = /(?:parameter|param|argument|arg)\s+([a-zA-Z_][a-zA-Z0-9_]*)[:\s]+([^.;]+)/gi;
  const matches = text.matchAll(paramPattern);
  
  for (const match of matches) {
    const paramName = match[1];
    const description = match[2].trim();
    hints.descriptions[paramName] = description;
    
    // Check if required/optional
    if (description.toLowerCase().includes('required')) {
      hints.required.push(paramName);
    } else if (description.toLowerCase().includes('optional')) {
      hints.optional.push(paramName);
    }
    
    // Extract type hints
    const typeMatch = description.match(/\b(string|number|boolean|integer|float|array|object)\b/i);
    if (typeMatch) {
      hints.types[paramName] = typeMatch[1].toLowerCase();
    }
    
    // Extract format hints (e.g., regex patterns)
    const formatMatch = description.match(/format[:\s]+([^\s,;]+)/i);
    if (formatMatch) {
      hints.formats[paramName] = formatMatch[1];
    }
  }
  
  return hints;
}

// Tool definitions
const tools = [
  {
    definition: createToolDefinition(
      "fetch_documentation",
      "Fetch HTML documentation from the hub. Returns the raw HTML content.",
      {
        properties: {
          url: {
            type: "string",
            description: "Documentation URL (optional, uses default drone.html if not provided)"
          }
        },
        required: []
      }
    ),
    executor: fetchDocumentation
  },
  {
    definition: createToolDefinition(
      "parse_html",
      "Parse HTML content to extract structured data like headings, code blocks, examples, paragraphs, lists, and tables.",
      {
        properties: {
          html: {
            type: "string",
            description: "HTML content to parse"
          },
          extractType: {
            type: "string",
            description: "Type of content to extract: 'all', 'headings', 'code', 'examples', 'paragraphs', 'lists', 'tables' (default: 'all')",
            enum: ["all", "headings", "code", "examples", "paragraphs", "lists", "tables"]
          }
        },
        required: ["html"]
      }
    ),
    executor: parseHtml
  },
  {
    definition: createToolDefinition(
      "extract_functions",
      "Extract all API function names and signatures from documentation. Returns list of functions with their parameters.",
      {
        properties: {
          html: {
            type: "string",
            description: "HTML documentation content"
          }
        },
        required: ["html"]
      }
    ),
    executor: extractFunctions
  },
  {
    definition: createToolDefinition(
      "understand_parameters",
      "Analyze parameter requirements for API functions. Extracts parameter types, formats, required/optional status, and descriptions.",
      {
        properties: {
          html: {
            type: "string",
            description: "HTML documentation content"
          },
          functionName: {
            type: "string",
            description: "Specific function to analyze (optional, analyzes all if not provided)"
          }
        },
        required: ["html"]
      }
    ),
    executor: understandParameters
  }
];

// Register all tools for documentation agent
toolRegistry.registerTools("documentation", tools);

log.info("Documentation agent tools registered");

export { fetchDocumentation, parseHtml, extractFunctions, understandParameters };

// Made with Bob