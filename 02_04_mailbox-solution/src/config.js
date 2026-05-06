/**
 * Configuration for mailbox task
 */

export const hub = {
  baseUrl: "https://hub.ag3nts.org",
  task: "mailbox"
};

export const api = {
  // Use cheap model for email search and extraction
  model: "gpt-4o-mini",
  maxOutputTokens: 2000
};

export const search = {
  // Known information about Wiktor's email
  domain: "proton.me",
  // What we're looking for
  targets: {
    password: "password to employee system",
    date: "attack date on power plant (YYYY-MM-DD)",
    confirmation_code: "security ticket confirmation code (SEC-XXXXXXXX...)"
  }
};

// Made with Bob
