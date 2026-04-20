import { fetchDocumentation, callOpenAI, analyzeImageWithGemini, HUB_URL } from "./api.js";

/**
 * Fetch and analyze all documentation files
 */
export async function analyzeDocumentation(taskRequirements) {
  console.log("📚 Fetching documentation...");
  
  // Fetch main documentation
  const indexResponse = await fetchDocumentation("index.md");
  const indexContent = await indexResponse.text();
  console.log("   ✓ Fetched index.md");
  
  // Fetch declaration template
  const templateResponse = await fetchDocumentation("zalacznik-E.md");
  const templateContent = await templateResponse.text();
  console.log("   ✓ Fetched zalacznik-E.md (declaration template)");
  
  // Fetch additional wagons info
  const wagonsResponse = await fetchDocumentation("dodatkowe-wagony.md");
  const wagonsContent = await wagonsResponse.text();
  console.log("   ✓ Fetched dodatkowe-wagony.md");
  
  // Fetch network map
  const mapResponse = await fetchDocumentation("zalacznik-F.md");
  const mapContent = await mapResponse.text();
  console.log("   ✓ Fetched zalacznik-F.md (network map)");
  
  // Analyze blocked routes image
  const blockedRoutesImageUrl = `${HUB_URL}/dane/doc/trasy-wylaczone.png`;
  console.log("   ✓ Fetching trasy-wylaczone.png");
  
  const blockedRoutesAnalysis = await analyzeImageWithGemini(
    blockedRoutesImageUrl,
    `Analyze this table of blocked railway routes. Extract information about route X-01 (Gdańsk - Żarnowiec):
    - Route code
    - Reason for blocking
    - Distance
    - Any special conditions
    
    Return the information in a structured format.`
  );
  console.log("   ✓ Analyzed blocked routes image");
  
  return {
    indexContent,
    templateContent,
    wagonsContent,
    mapContent,
    blockedRoutesAnalysis
  };
}

/**
 * Determine the correct shipment category based on content description
 */
export async function determineCategory(contentDescription, documentation) {
  const prompt = `Based on the SPK (System Przesyłek Konduktorskich) documentation, determine the correct shipment category for the following content:

Content: ${contentDescription}

Documentation excerpt about categories:
${documentation.indexContent.substring(documentation.indexContent.indexOf("## 4. KLASYFIKACJA PRZESYŁEK"), documentation.indexContent.indexOf("## 5. PROCEDURA NADANIA"))}

Categories:
- A: Strategic (0 PP, System-funded, can use blocked routes)
- B: Medical (0 PP, System-funded, can use blocked routes)
- C: Food
- D: Economic
- E: Personal

Analyze the content and determine which category it belongs to. Consider that:
1. Reactor fuel cassettes are strategic materials
2. Category A and B can use blocked routes
3. Category A and B cost 0 PP

Return ONLY the category letter (A, B, C, D, or E) and a brief explanation.`;

  const response = await callOpenAI([
    { role: "system", content: "You are an expert in logistics and classification systems. Provide concise, accurate answers." },
    { role: "user", content: prompt }
  ]);
  
  return response;
}

/**
 * Calculate the number of additional wagons needed
 */
export async function calculateWagons(weight, documentation) {
  const prompt = `Based on the SPK documentation, calculate how many additional wagons are needed for a shipment.

Weight: ${weight} kg

Documentation about wagons:
${documentation.wagonsContent}

Standard train capacity: 2 wagons × 500 kg = 1000 kg

Calculate:
1. How much additional capacity is needed beyond the standard 1000 kg
2. How many additional wagons (500 kg each) are required
3. The value for the WDP field (Wagon Dodatkowy Potrzebny - additional wagons needed)

Return ONLY the number for the WDP field and a brief calculation explanation.`;

  const response = await callOpenAI([
    { role: "system", content: "You are a logistics calculator. Provide precise numerical answers." },
    { role: "user", content: prompt }
  ]);
  
  return response;
}

/**
 * Determine the route code
 */
export async function determineRoute(origin, destination, documentation) {
  const prompt = `Based on the SPK documentation and blocked routes analysis, determine the correct route code.

Origin: ${origin}
Destination: ${destination}

Blocked routes analysis:
${documentation.blockedRoutesAnalysis}

Network map:
${documentation.mapContent}

Key information from documentation:
- Route X-01 connects Gdańsk to Żarnowiec
- This route is blocked but can be used by Category A and B shipments
- The task mentions "don't worry that the route is closed"

Return ONLY the route code (e.g., X-01, M-10, R-05) and a brief explanation.`;

  const response = await callOpenAI([
    { role: "system", content: "You are a railway network expert. Provide accurate route codes." },
    { role: "user", content: prompt }
  ]);
  
  return response;
}

/**
 * Calculate the total cost
 */
export async function calculateCost(category, weight, route, documentation) {
  const prompt = `Based on the SPK documentation, calculate the total shipping cost.

Category: ${category}
Weight: ${weight} kg
Route: ${route}

Documentation excerpt about fees:
${documentation.indexContent.substring(documentation.indexContent.indexOf("## 9. TABELA OPŁAT"), documentation.indexContent.indexOf("## 10. PROCEDURY AWARYJNE"))}

Calculate:
1. Base fee for the category
2. Weight-based fee
3. Route-based fee
4. Additional wagon fees (if applicable)
5. Total cost in PP (Punkty Pracy)

Note: Category A and B shipments are System-funded (0 PP) and additional wagons are free.

Return ONLY the total cost in PP and a brief breakdown.`;

  const response = await callOpenAI([
    { role: "system", content: "You are a logistics cost calculator. Provide accurate cost calculations." },
    { role: "user", content: prompt }
  ]);
  
  return response;
}

/**
 * Build the complete declaration using AI analysis
 */
export async function buildDeclarationWithAI(taskRequirements, documentation) {
  console.log("\n🤖 Analyzing documentation with AI...");
  
  // Determine category
  console.log("   Determining shipment category...");
  const categoryAnalysis = await determineCategory(taskRequirements.content, documentation);
  console.log(`   ✓ Category analysis: ${categoryAnalysis}`);
  const category = categoryAnalysis.match(/^[A-E]/)?.[0] || "A";
  
  // Calculate wagons
  console.log("   Calculating wagon requirements...");
  const wagonAnalysis = await calculateWagons(taskRequirements.weight, documentation);
  console.log(`   ✓ Wagon analysis: ${wagonAnalysis}`);
  const wdp = parseInt(wagonAnalysis.match(/\d+/)?.[0] || "4");
  
  // Determine route
  console.log("   Determining route code...");
  const routeAnalysis = await determineRoute(taskRequirements.origin, taskRequirements.destination, documentation);
  console.log(`   ✓ Route analysis: ${routeAnalysis}`);
  const route = routeAnalysis.match(/X-\d+|M-\d+|R-\d+/)?.[0] || "X-01";
  
  // Calculate cost
  console.log("   Calculating total cost...");
  const costAnalysis = await calculateCost(category, taskRequirements.weight, route, documentation);
  console.log(`   ✓ Cost analysis: ${costAnalysis}`);
  const cost = parseInt(costAnalysis.match(/\d+\s*PP/)?.[0] || "0");
  
  return {
    category,
    wdp,
    route,
    cost,
    analyses: {
      categoryAnalysis,
      wagonAnalysis,
      routeAnalysis,
      costAnalysis
    }
  };
}


