const AGENT_TOKEN = process.env.AGENT_TOKEN;
const SHELL_API_URL = 'https://hub.ag3nts.org/api/shell';

export async function executeShellCommand(cmd) {
  const response = await fetch(SHELL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apikey: AGENT_TOKEN,
      cmd,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shell API request failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  
  // Handle error codes from API
  // Positive codes (100+) are SUCCESS with data in message
  // Negative codes are ERRORS
  if (data.code) {
    if (data.code === 429) {
      throw new Error('Rate limit exceeded. Wait before retrying.');
    } else if (data.code === 403) {
      const banTime = data.message?.match(/(\d+) seconds/)?.[1] || 'unknown';
      throw new Error(`Access banned for ${banTime} seconds due to security violation.`);
    } else if (data.code === 503) {
      throw new Error('Service temporarily unavailable. Retry later.');
    } else if (data.code < 0) {
      // Negative codes are errors
      throw new Error(`Shell API error ${data.code}: ${data.message || 'Unknown error'}`);
    }
    // Positive codes are success - return the message as the result
  }

  return data;
}

export async function submitAnswer(answer) {
  const response = await fetch('https://hub.ag3nts.org/api/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apikey: AGENT_TOKEN,
      task: 'firmware',
      answer,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Submit failed: ${response.status} ${error}`);
  }

  return response.json();
}


