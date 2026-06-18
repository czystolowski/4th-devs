/**
 * Sensor data validator
 * Detects anomalies using programmatic checks
 */

import { SENSOR_RANGES, SENSOR_FIELDS, ALL_FIELDS } from "./config.js";

/**
 * Check if sensor value is out of range
 */
function isOutOfRange(field, value) {
  if (value === 0) return false; // Inactive sensor
  
  const range = SENSOR_RANGES[field];
  if (!range) return false;
  
  return value < range.min || value > range.max;
}

/**
 * Get expected active fields for sensor type
 */
function getExpectedFields(sensorType) {
  const types = sensorType.split('/');
  const expectedFields = new Set();
  
  for (const type of types) {
    const fields = SENSOR_FIELDS[type];
    if (fields) {
      fields.forEach(f => expectedFields.add(f));
    }
  }
  
  return expectedFields;
}

/**
 * Check if sensor has unexpected active fields
 */
function hasUnexpectedFields(sensorData) {
  const expectedFields = getExpectedFields(sensorData.sensor_type);
  
  for (const field of ALL_FIELDS) {
    const value = sensorData[field];
    const isActive = value !== 0;
    const isExpected = expectedFields.has(field);
    
    // Anomaly: field is active but not expected for this sensor type
    if (isActive && !isExpected) {
      return true;
    }
  }
  
  return false;
}

/**
 * Perform programmatic validation (no LLM needed)
 * Returns array of file IDs with anomalies
 */
export function validateProgrammatically(sensorsData) {
  const anomalies = [];
  
  for (const [fileId, sensorData] of Object.entries(sensorsData)) {
    let hasAnomaly = false;
    
    // Check 1: Out of range values
    for (const field of ALL_FIELDS) {
      if (isOutOfRange(field, sensorData[field])) {
        hasAnomaly = true;
        break;
      }
    }
    
    // Check 2: Unexpected active fields
    if (!hasAnomaly && hasUnexpectedFields(sensorData)) {
      hasAnomaly = true;
    }
    
    if (hasAnomaly) {
      anomalies.push(fileId);
    }
  }
  
  return anomalies;
}

