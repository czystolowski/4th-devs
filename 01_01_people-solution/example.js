/**
 * Example usage of the PeopleDatabase with sample data
 * This demonstrates all filtering capabilities without requiring API calls
 */

import { PeopleDatabase } from "./database.js";

// Sample data matching the required format
const samplePeople = [
  {
    name: "Jan",
    surname: "Kowalski",
    gender: "M",
    born: 1987,
    city: "Warszawa",
    tags: ["IT", "praca z ludźmi"]
  },
  {
    name: "Anna",
    surname: "Nowak",
    gender: "F",
    born: 1993,
    city: "Grudziądz",
    tags: ["medycyna", "praca z ludźmi"]
  },
  {
    name: "Piotr",
    surname: "Wiśniewski",
    gender: "M",
    born: 1975,
    city: "Kraków",
    tags: ["transport", "praca z pojazdami"]
  },
  {
    name: "Maria",
    surname: "Wójcik",
    gender: "F",
    born: 1990,
    city: "Warszawa",
    tags: ["edukacja", "praca z ludźmi"]
  },
  {
    name: "Tomasz",
    surname: "Kamiński",
    gender: "M",
    born: 1985,
    city: "Gdańsk",
    tags: ["IT", "transport"]
  },
  {
    name: "Katarzyna",
    surname: "Lewandowska",
    gender: "F",
    born: 1988,
    city: "Poznań",
    tags: ["praca fizyczna"]
  }
];

function main() {
  console.log("🔍 PeopleDatabase Example Usage");
  console.log("=".repeat(50));

  // Create database
  const db = new PeopleDatabase(samplePeople);
  
  console.log("\n📊 Statistics:");
  const stats = db.getStats();
  console.log(`Total people: ${stats.total}`);
  console.log(`Gender: ${stats.byGender.M} male, ${stats.byGender.F} female`);
  console.log(`Age range: ${stats.age.min}-${stats.age.max} (avg: ${stats.age.avg})`);
  console.log(`Cities: ${stats.cities}`);
  console.log(`Specializations: ${stats.specializations.join(', ')}`);

  console.log("\n🔍 Filter Examples:");
  
  // Filter by gender
  console.log("\n1. Males:");
  const males = db.filterByGender('M');
  console.log(`   Count: ${males.count()}`);
  males.getAll().forEach(p => console.log(`   - ${p.name} ${p.surname}`));

  // Filter by age range
  console.log("\n2. Age 30-40:");
  const age30to40 = db.filterByAge(30, 40);
  console.log(`   Count: ${age30to40.count()}`);
  age30to40.getAll().forEach(p => {
    const age = new Date().getFullYear() - p.born;
    console.log(`   - ${p.name} ${p.surname} (${age} years old)`);
  });

  // Filter by city
  console.log("\n3. From Warszawa:");
  const fromWarsaw = db.filterByCity('Warszawa');
  console.log(`   Count: ${fromWarsaw.count()}`);
  fromWarsaw.getAll().forEach(p => console.log(`   - ${p.name} ${p.surname}`));

  // Filter by specialization
  console.log("\n4. IT specialists:");
  const itPeople = db.filterBySpecialization('IT');
  console.log(`   Count: ${itPeople.count()}`);
  itPeople.getAll().forEach(p => console.log(`   - ${p.name} ${p.surname} (${p.tags.join(', ')})`));

  // Filter by multiple specializations (any)
  console.log("\n5. People with 'praca z ludźmi' specialization:");
  const peopleWorkers = db.filterBySpecialization('praca z ludźmi');
  console.log(`   Count: ${peopleWorkers.count()}`);
  peopleWorkers.getAll().forEach(p => console.log(`   - ${p.name} ${p.surname} (${p.tags.join(', ')})`));

  // Chain filters
  console.log("\n6. Males aged 30-50 from Warszawa:");
  const filtered = db
    .filterByGender('M')
    .filterByAge(30, 50)
    .filterByCity('Warszawa');
  console.log(`   Count: ${filtered.count()}`);
  filtered.getAll().forEach(p => {
    const age = new Date().getFullYear() - p.born;
    console.log(`   - ${p.name} ${p.surname} (${age} years old, ${p.tags.join(', ')})`);
  });

  // Search by name
  console.log("\n7. Search for 'Anna':");
  const searchResults = db.search('Anna');
  console.log(`   Count: ${searchResults.count()}`);
  searchResults.getAll().forEach(p => console.log(`   - ${p.name} ${p.surname}`));

  // Sort by birth year
  console.log("\n8. Sorted by birth year (oldest first):");
  const sorted = db.sortBy('born', 'asc');
  sorted.getAll().slice(0, 3).forEach(p => {
    console.log(`   - ${p.name} ${p.surname} (born ${p.born})`);
  });

  // Get unique cities
  console.log("\n9. All cities:");
  const cities = db.getCities();
  console.log(`   ${cities.join(', ')}`);

  // JSON output
  console.log("\n📄 JSON Output (first 2 people):");
  console.log(JSON.stringify(db.getAll().slice(0, 2), null, 2));

  console.log("\n✅ Example complete!");
}

main();


