/**
 * PeopleDatabase - In-memory database with filtering capabilities
 * Provides methods to filter people by various criteria
 */
export class PeopleDatabase {
  constructor(people = []) {
    this.people = people;
  }

  getAll() {
    return [...this.people];
  }

  /**
   * Filter by gender
   * @param {string} gender - "M" or "F"
   */
  filterByGender(gender) {
    const filtered = this.people.filter(person => person.gender === gender);
    return new PeopleDatabase(filtered);
  }

  /**
   * Filter by age range
   * @param {number} minAge - Minimum age (inclusive)
   * @param {number} maxAge - Maximum age (inclusive)
   */
  filterByAge(minAge, maxAge) {
    const currentYear = new Date().getFullYear();
    const filtered = this.people.filter(person => {
      const age = currentYear - person.born;
      return age >= minAge && age <= maxAge;
    });
    return new PeopleDatabase(filtered);
  }

  /**
   * Filter by birth year range
   * @param {number} minYear - Minimum birth year (inclusive)
   * @param {number} maxYear - Maximum birth year (inclusive)
   */
  filterByBirthYear(minYear, maxYear) {
    const filtered = this.people.filter(person => {
      return person.born >= minYear && person.born <= maxYear;
    });
    return new PeopleDatabase(filtered);
  }

  /**
   * Filter by city (case-insensitive)
   * @param {string} city - City name
   */
  filterByCity(city) {
    const cityLower = city.toLowerCase();
    const filtered = this.people.filter(person => 
      person.city.toLowerCase() === cityLower
    );
    return new PeopleDatabase(filtered);
  }

  /**
   * Filter by specialization/tag
   * @param {string} specialization - Specialization to filter by
   */
  filterBySpecialization(specialization) {
    const filtered = this.people.filter(person => 
      person.tags.includes(specialization)
    );
    return new PeopleDatabase(filtered);
  }

  /**
   * Filter by multiple specializations (person must have at least one)
   * @param {string[]} specializations - Array of specializations
   */
  filterByAnySpecialization(specializations) {
    const filtered = this.people.filter(person => 
      person.tags.some(tag => specializations.includes(tag))
    );
    return new PeopleDatabase(filtered);
  }

  /**
   * Filter by multiple specializations (person must have all)
   * @param {string[]} specializations - Array of specializations
   */
  filterByAllSpecializations(specializations) {
    const filtered = this.people.filter(person => 
      specializations.every(spec => person.tags.includes(spec))
    );
    return new PeopleDatabase(filtered);
  }

  /**
   * Search by name or surname (case-insensitive, partial match)
   * @param {string} query - Search query
   */
  search(query) {
    const queryLower = query.toLowerCase();
    const filtered = this.people.filter(person => 
      person.name.toLowerCase().includes(queryLower) ||
      person.surname.toLowerCase().includes(queryLower)
    );
    return new PeopleDatabase(filtered);
  }

  /**
   * Get unique cities
   */
  getCities() {
    return [...new Set(this.people.map(p => p.city))].sort();
  }

  /**
   * Get unique specializations
   */
  getSpecializations() {
    const allTags = this.people.flatMap(p => p.tags);
    return [...new Set(allTags)].sort();
  }

  /**
   * Get statistics
   */
  getStats() {
    const currentYear = new Date().getFullYear();
    const ages = this.people.map(p => currentYear - p.born);
    
    return {
      total: this.people.length,
      byGender: {
        M: this.people.filter(p => p.gender === 'M').length,
        F: this.people.filter(p => p.gender === 'F').length
      },
      age: {
        min: Math.min(...ages),
        max: Math.max(...ages),
        avg: Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      },
      cities: this.getCities().length,
      specializations: this.getSpecializations()
    };
  }

  /**
   * Sort by field
   * @param {string} field - Field to sort by
   * @param {string} order - "asc" or "desc"
   */
  sortBy(field, order = 'asc') {
    const sorted = [...this.people].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      
      if (typeof aVal === 'string') {
        return order === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return new PeopleDatabase(sorted);
  }

  /**
   * Get count
   */
  count() {
    return this.people.length;
  }

  /**
   * Convert to JSON array
   */
  toJSON() {
    return this.people;
  }
}


