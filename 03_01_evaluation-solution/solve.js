/**
 * Evaluation task solution: Find 52 sensor anomalies
 * - 46 programmatic (out-of-range values, unexpected fields)
 * - 6 from LLM analysis of operator notes
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateProgrammatically } from './src/validator.js';
import { submitAnomalies } from './src/helpers/hub.js';
import {
  AI_API_KEY,
  RESPONSES_API_ENDPOINT,
  EXTRA_API_HEADERS,
  resolveModelForProvider
} from "../config.js";

async function chat({ model, messages }) {
  const userMessage = messages.find(m => m.role === "user");
  
  const body = {
    model: resolveModelForProvider(model),
    temperature: 0,
    input: [{ role: "user", content: userMessage.content }]
  };

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function main() {
  console.log('Loading sensor data...');
  const files = readdirSync('./workspace').filter(f => f.endsWith('.json'));
  const sensorsData = {};
  
  for (const file of files) {
    const fileId = file.replace('.json', '');
    const data = JSON.parse(readFileSync(join('./workspace', file), 'utf-8'));
    sensorsData[fileId] = data;
  }
  console.log(`Loaded ${files.length} files`);

  // Step 1: Programmatic detection (46 anomalies)
  console.log('\nStep 1: Programmatic detection...');
  const programmatic = validateProgrammatically(sensorsData);
  console.log(`Found ${programmatic.length} programmatic anomalies`);

  // Step 2: Split notes by comma and deduplicate first parts
  console.log('\nStep 2: Split and deduplicate notes...');
  const programmaticSet = new Set(programmatic);
  const firstPartMap = new Map();
  
  for (const [fileId, data] of Object.entries(sensorsData)) {
    if (!programmaticSet.has(fileId)) {
      const parts = data.operator_notes.trim().split(',').map(p => p.trim());
      const firstPart = parts[0] || data.operator_notes.trim();
      
      if (!firstPartMap.has(firstPart)) {
        firstPartMap.set(firstPart, []);
      }
      firstPartMap.get(firstPart).push(fileId);
    }
  }
  
  const uniqueFirstParts = Array.from(firstPartMap.keys());
  console.log(`Found ${uniqueFirstParts.length} unique first parts`);

  // Step 3: LLM analysis of first parts
  console.log('\nStep 3: LLM analysis...');
  const prompt = `Analyze these sensor operator note fragments. Identify which ones indicate a PROBLEM or ISSUE (not normal operation).
Return ONLY the numbers of fragments that indicate problems.

Fragments:
${uniqueFirstParts.map((part, i) => `${i + 1}. ${part}`).join('\n')}

Format: one number per line`;

  const llmAnomalies = [];
  try {
    const response = await chat({
      model: 'gpt-4o-mini',
      messages: [{role: 'user', content: prompt}]
    });
    
    const message = response.output?.find(item => item.type === "message");
    const text = message?.content?.[0]?.text || '';
    const problemNumbers = text.match(/\d+/g) || [];
    
    console.log(`LLM found ${problemNumbers.length} problem fragments`);
    
    for (const numStr of problemNumbers) {
      const index = parseInt(numStr) - 1;
      if (index >= 0 && index < uniqueFirstParts.length) {
        const firstPart = uniqueFirstParts[index];
        const fileIds = firstPartMap.get(firstPart) || [];
        llmAnomalies.push(...fileIds);
      }
    }
  } catch (error) {
    console.error('LLM call failed:', error.message);
  }

  console.log(`LLM found ${llmAnomalies.length} anomalies from problem notes`);

  // Combine and submit
  const allAnomalies = [...new Set([...programmatic, ...llmAnomalies])];
  console.log(`\nTotal: ${allAnomalies.length} anomalies`);
  console.log('Submitting...');

  try {
    const response = await submitAnomalies(allAnomalies);
    console.log('✅ SUCCESS!', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

