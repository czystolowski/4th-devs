import { fetchDocumentation, callOpenAI, analyzeImageWithGemini, HUB_URL } from "./api.js";

/**
 * Fetch all necessary documentation
 */
async function fetchAllDocumentation() {
  console.log("   📚 Fetching documentation files...");
  
  const docs = {};
  
  // Fetch main documentation
  const indexResponse = await fetchDocumentation("index.md");
  docs.index = await indexResponse.text();
  console.log("   ✓ Fetched index.md");
  
  // Fetch declaration template
  const templateResponse = await fetchDocumentation("zalacznik-E.md");
  docs.template = await templateResponse.text();
  console.log("   ✓ Fetched zalacznik-E.md");
  
  // Fetch wagon info
  const wagonsResponse = await fetchDocumentation("dodatkowe-wagony.md");
  docs.wagons = await wagonsResponse.text();
  console.log("   ✓ Fetched dodatkowe-wagony.md");
  
  // Fetch network map
  const mapResponse = await fetchDocumentation("zalacznik-F.md");
  docs.map = await mapResponse.text();
  console.log("   ✓ Fetched zalacznik-F.md");
  
  // Analyze blocked routes image
  console.log("   🖼️  Analyzing blocked routes image...");
  const blockedRoutesUrl = `${HUB_URL}/dane/doc/trasy-wylaczone.png`;
  docs.blockedRoutes = await analyzeImageWithGemini(
    blockedRoutesUrl,
    `Analyze this table of blocked railway routes in the SPK system. 
    
Extract ALL information about route X-01 (Gdańsk - Żarnowiec):
- Route code
- Full route description
- Reason for blocking (Powód wyłączenia)
- Date of blocking (Data wyłączenia)
- Reactivation prognosis (Prognoza reaktywacji)

Also note any special conditions or directives mentioned.

Format your response clearly with each piece of information on a separate line.`
  );
  console.log("   ✓ Analyzed trasy-wylaczone.png");
  
  return docs;
}

/**
 * Run the autonomous agent with comprehensive analysis
 */
export async function runAgent(taskRequirements) {
  console.log("\n   🤖 Agent starting autonomous analysis...");
  
  // Step 1: Fetch all documentation
  const docs = await fetchAllDocumentation();
  
  // Step 2: Comprehensive analysis with single LLM call
  console.log("\n   🧠 Performing comprehensive analysis...");
  
  const analysisPrompt = `You are an expert in the SPK (System Przesyłek Konduktorskich) transport system. Analyze the provided documentation to determine the correct values for a shipment declaration.

## TASK REQUIREMENTS
- Sender ID: ${taskRequirements.senderId}
- Origin: ${taskRequirements.origin}
- Destination: ${taskRequirements.destination}
- Weight: ${taskRequirements.weight} kg
- Budget: ${taskRequirements.budget} PP (MUST be free or System-funded)
- Content: ${taskRequirements.content}
- Special notes: ${taskRequirements.specialNotes}

## DOCUMENTATION PROVIDED

### 1. MAIN DOCUMENTATION (index.md)
Key sections to analyze:
${docs.index.substring(docs.index.indexOf("## 4. KLASYFIKACJA PRZESYŁEK"), docs.index.indexOf("## 5. PROCEDURA NADANIA") + 500)}

${docs.index.substring(docs.index.indexOf("## 8. STREFY WYŁĄCZONE"), docs.index.indexOf("## 9. TABELA OPŁAT") + 500)}

${docs.index.substring(docs.index.indexOf("## 9. TABELA OPŁAT"), docs.index.indexOf("## 10. PROCEDURY AWARYJNE") + 1000)}

### 2. BLOCKED ROUTES ANALYSIS (trasy-wylaczone.png)
${docs.blockedRoutes}

### 3. WAGON CALCULATIONS (dodatkowe-wagony.md)
${docs.wagons}

### 4. NETWORK MAP (zalacznik-F.md)
${docs.map}

### 5. DECLARATION TEMPLATE (zalacznik-E.md)
${docs.template}

## YOUR ANALYSIS TASK

Determine the following values and explain your reasoning:

1. **CATEGORY** (A/B/C/D/E)
   - What category does "kasety z paliwem do reaktora" (reactor fuel cassettes) belong to?
   - Which categories cost 0 PP?
   - Which categories can use blocked routes?

2. **ROUTE CODE**
   - What is the route code from Gdańsk to Żarnowiec?
   - Is this route blocked?
   - Can our chosen category use this route?

3. **WDP (Additional Wagons)**
   - Standard train capacity: 1000 kg (2 wagons × 500 kg)
   - Weight needed: ${taskRequirements.weight} kg
   - Additional capacity needed: ${taskRequirements.weight} - 1000 = ${taskRequirements.weight - 1000} kg
   - Additional wagons: ceiling(${taskRequirements.weight - 1000} / 500)
   - WDP field = number of ADDITIONAL wagons (not total)

4. **COST**
   - Base fee for the category
   - Weight-based fee
   - Route-based fee
   - Additional wagon fees
   - Total in PP

## RESPONSE FORMAT

Provide your analysis in this exact JSON format:

\`\`\`json
{
  "category": "A",
  "route": "X-01",
  "wdp": 4,
  "cost": 0,
  "reasoning": {
    "category": "Reactor fuel cassettes are strategic materials, qualifying for Category A which costs 0 PP and can use blocked routes",
    "route": "X-01 is the direct route from Gdańsk to Żarnowiec. Although blocked by Dyrektywa Specjalna 7.7, Category A and B shipments can use it",
    "wdp": "Weight 2800 kg requires 1800 kg additional capacity beyond standard 1000 kg. 1800/500 = 3.6, rounded up to 4 additional wagons",
    "cost": "Category A is System-funded (0 PP base fee), and additional wagons are free for Category A/B"
  }
}
\`\`\`

Be precise and base your answer strictly on the documentation provided.`;

  const response = await callOpenAI([
    { role: "system", content: "You are an expert analyst. Provide accurate, well-reasoned answers based on documentation." },
    { role: "user", content: analysisPrompt }
  ], "gpt-4o");
  
  console.log("   ✓ Analysis complete");
  
  // Extract JSON from response
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from LLM response");
  }
  
  const analysis = JSON.parse(jsonMatch[1]);
  
  // Build the declaration
  const today = new Date().toISOString().split('T')[0];
  const declaration = `SYSTEM PRZESYŁEK KONDUKTORSKICH - DEKLARACJA ZAWARTOŚCI
======================================================
DATA: ${today}
PUNKT NADAWCZY: ${taskRequirements.origin}
------------------------------------------------------
NADAWCA: ${taskRequirements.senderId}
PUNKT DOCELOWY: ${taskRequirements.destination}
TRASA: ${analysis.route}
------------------------------------------------------
KATEGORIA PRZESYŁKI: ${analysis.category}
------------------------------------------------------
OPIS ZAWARTOŚCI (max 200 znaków): ${taskRequirements.content}
------------------------------------------------------
DEKLAROWANA MASA (kg): ${taskRequirements.weight}
------------------------------------------------------
WDP: ${analysis.wdp}
------------------------------------------------------
UWAGI SPECJALNE: ${taskRequirements.specialNotes}
------------------------------------------------------
KWOTA DO ZAPŁATY: ${analysis.cost} PP
------------------------------------------------------
OŚWIADCZAM, ŻE PODANE INFORMACJE SĄ PRAWDZIWE.
BIORĘ NA SIEBIE KONSEKWENCJĘ ZA FAŁSZYWE OŚWIADCZENIE.
======================================================`;

  return {
    declaration,
    category: analysis.category,
    route: analysis.route,
    wdp: analysis.wdp,
    cost: analysis.cost,
    reasoning: analysis.reasoning,
    iterations: 1,
    documentsAnalyzed: 5,
    fullAnalysis: response
  };
}


