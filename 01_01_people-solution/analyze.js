import { readFile } from "node:fs/promises";
import { AGENT_TOKEN } from "../config.js";
import { downloadCSV, parseCSV, extractBirthYear, normalizeCity } from "./helpers.js";
import { PeopleDatabase } from "./database.js";

const CSV_URL = `https://hub.ag3nts.org/data/${AGENT_TOKEN}/people.csv`;

function processPersonRow(row) {
  const birthYear = extractBirthYear(row.birthDate);
  const city = normalizeCity(row.birthPlace);
  
  return {
    name: row.name,
    surname: row.surname,
    gender: row.gender,
    born: birthYear,
    city: city,
    job: row.job || "",
    tags: []
  };
}

async function analyze() {
  console.log("🔍 Analyzing data...\n");
  
  try {
    // Download and parse
    const csvText = await downloadCSV(CSV_URL);
    const csvData = parseCSV(csvText);
    const allPeople = csvData.map(processPersonRow).filter(p => p.born !== null);
    
    console.log(`Total people: ${allPeople.length}`);
    
    // Apply filters
    const db = new PeopleDatabase(allPeople);
    const currentYear = 2026;
    const minBirthYear = currentYear - 40; // 1986
    const maxBirthYear = currentYear - 20; // 2006
    
    const males = db.filterByGender('M');
    console.log(`Males: ${males.count()}`);
    
    const cityFiltered = males.filterByCity('Grudziądz');
    console.log(`From Grudziądz: ${cityFiltered.count()}`);

    const ageFiltered = cityFiltered.filterByBirthYear(minBirthYear, maxBirthYear);
    console.log(`Males age 20-40 (born ${minBirthYear}-${maxBirthYear}): ${ageFiltered.count()}`);
    
    // Show sample job descriptions
    const people = ageFiltered.getAll();
    console.log(`\nCandidates:`);
    people.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name} ${p.surname} (${p.born})`);
      console.log(`   Job: ${p.job.substring(0, 150)}...`);
    });
    
    // Check for transport-related keywords in job descriptions
    // console.log(`\nAnalyzing job descriptions for transport keywords...`);
    // const transportKeywords = ['transport', 'pojazd', 'kierow', 'logistyk', 'dostaw', 'przewóz', 'samochód', 'ciężar'];
    // const potentialTransport = people.filter(p => {
    //   const jobLower = p.job.toLowerCase();
    //   return transportKeywords.some(keyword => jobLower.includes(keyword));
    // });
    
    // console.log(`People with transport-related keywords: ${potentialTransport.length}`);
    // potentialTransport.forEach(p => {
    //   console.log(`  - ${p.name} ${p.surname}`);
    // });
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

analyze();