/**
 * JSON Schema for structured person data extraction
 * Combines concepts from 01_01_structured with domain-specific requirements
 */

export const ALLOWED_SPECIALIZATIONS = [
  "IT",
  "transport",
  "edukacja",
  "medycyna",
  "praca z ludźmi",
  "praca z pojazdami",
  "praca fizyczna"
];

// not required after moving processing to the code
export const personSchema = {
  type: "json_schema",
  name: "person",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "First name of the person"
      },
      surname: {
        type: "string",
        description: "Last name/surname of the person"
      },
      gender: {
        type: "string",
        enum: ["M", "F"],
        description: "Gender: M for male, F for female"
      },
      born: {
        type: "number",
        description: "Birth year (4-digit year)"
      },
      city: {
        type: "string",
        description: "City of birth, normalized without special characters"
      },
      tags: {
        type: "array",
        items: {
          type: "string",
          enum: ALLOWED_SPECIALIZATIONS
        },
        description: `Specializations/tags from allowed list: ${ALLOWED_SPECIALIZATIONS.join(', ')}`
      }
    },
    required: ["name", "surname", "gender", "born", "city", "tags"],
    additionalProperties: false
  }
};

/**
 * Schema for enriching person data with specializations
 * Used in multi-turn conversation to infer specializations from context
 */
export const specializationSchema = {
  type: "json_schema",
  name: "specializations",
  strict: true,
  schema: {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: {
          type: "string",
          enum: ALLOWED_SPECIALIZATIONS
        },
        description: `List of applicable specializations from: ${ALLOWED_SPECIALIZATIONS.join(', ')}`
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of why these specializations were chosen"
      }
    },
    required: ["tags", "reasoning"],
    additionalProperties: false
  }
};


