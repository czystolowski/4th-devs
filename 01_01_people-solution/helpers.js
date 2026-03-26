/**
 * Extract text response from API response data
 */
export function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const messages = Array.isArray(data?.output)
    ? data.output.filter((item) => item?.type === "message")
    : [];

  const textPart = messages
    .flatMap((message) => (Array.isArray(message?.content) ? message.content : []))
    .find((part) => part?.type === "output_text" && typeof part?.text === "string");

  return textPart?.text ?? "";
};

/**
 * Create a message object for AI conversation
 */
export const toMessage = (role, content) => ({ type: "message", role, content });

/**
 * Download CSV content from URL
 */
export async function downloadCSV(url) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
  }

  // Get the raw buffer
  const buffer = await response.arrayBuffer();
  
  // Try to decode as UTF-8, fallback to latin1 if needed
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // If UTF-8 fails, try latin1 (ISO-8859-1) which is common for Polish characters
    text = new TextDecoder('iso-8859-1').decode(buffer);
  }

  return text;
}

/**
 * Parse CSV text into array of objects
 * Handles both comma-separated and tab-separated values
 */
export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Detect delimiter (comma or tab)
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  
  // Parse header
  const headers = parseCSVLine(firstLine, delimiter);
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }

  return data;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line, delimiter = ',') {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  values.push(current.trim());
  
  return values;
}

/**
 * Calculate age from birth date string
 */
export function calculateAge(birthDateStr) {
  // Parse various date formats (e.g., "7/7/75", "1975-07-07")
  const parts = birthDateStr.split(/[\/\-]/);
  
  let year, month, day;
  
  if (parts.length === 3) {
    // Assume M/D/YY or D/M/YY format
    if (parts[2].length === 2) {
      // Two-digit year
      const yy = parseInt(parts[2]);
      // Assume 1900s for years >= 50, 2000s for years < 50
      year = yy >= 50 ? 1900 + yy : 2000 + yy;
    } else {
      year = parseInt(parts[2]);
    }
    month = parseInt(parts[0]);
    day = parseInt(parts[1]);
  } else {
    return null;
  }

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Extract birth year from date string
 */
export function extractBirthYear(birthDateStr) {
  const parts = birthDateStr.split(/[\/\-]/);
  
  if (parts.length === 3) {
    if (parts[2].length === 2) {
      const yy = parseInt(parts[2]);
      return yy >= 50 ? 1900 + yy : 2000 + yy;
    } else {
      return parseInt(parts[2]);
    }
  }
  
  return null;
}

/**
 * Normalize city name (handle special characters)
 */
export function normalizeCity(city) {
  // Remove special characters and normalize
  return city
    .replace(/[≈öø]/g, 'o')
    .replace(/[äå]/g, 'a')
    .replace(/[ü]/g, 'u')
    .trim();
}


