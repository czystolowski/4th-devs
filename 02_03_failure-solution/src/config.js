/**
 * Configuration for failure log compression task
 */

export const hub = {
  baseUrl: "https://hub.ag3nts.org",
  task: "failure"
};

export const api = {
  // Use cheap model for log analysis to stay within budget
  model: "gpt-4o-mini",
  maxOutputTokens: 2000
};

export const compression = {
  // Maximum tokens allowed for compressed logs
  maxTokens: 1500,
  // Conservative token estimation (chars / 3.5)
  charsPerToken: 3.5
};

export const logLevels = {
  critical: ["WARN", "ERRO", "CRIT"],
  all: ["INFO", "WARN", "ERRO", "CRIT"]
};

export const powerPlantComponents = [
  "ECCS",    // Emergency Core Cooling System
  "PWR",     // Power
  "WTANK",   // Water Tank
  "PUMP",    // Pump
  "VALVE",   // Valve
  "CTRL",    // Control
  "SENS",    // Sensor
  "COOL",    // Cooling
  "REACT",   // Reactor
  "STMTURB", // Steam Turbine
  "WTRPMP",  // Water Pump
  "WSTPOOL", // Waste Pool
  "FIRMWARE" // Firmware
];

