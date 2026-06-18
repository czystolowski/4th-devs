/**
 * Configuration for sensor evaluation task
 */

// Valid ranges for active sensors
export const SENSOR_RANGES = {
  temperature_K: { min: 553, max: 873 },
  pressure_bar: { min: 60, max: 160 },
  water_level_meters: { min: 5.0, max: 15.0 },
  voltage_supply_v: { min: 229.0, max: 231.0 },
  humidity_percent: { min: 40.0, max: 80.0 }
};

// Sensor type to field mapping
export const SENSOR_FIELDS = {
  temperature: ['temperature_K'],
  pressure: ['pressure_bar'],
  water: ['water_level_meters'],
  voltage: ['voltage_supply_v'],
  humidity: ['humidity_percent']
};

// All measurement fields
export const ALL_FIELDS = [
  'temperature_K',
  'pressure_bar',
  'water_level_meters',
  'voltage_supply_v',
  'humidity_percent'
];

// Model configuration
export const model = "gpt-4o-mini"; // Cheap model for classification
export const budget = 1.0; // $1 budget for LLM calls

