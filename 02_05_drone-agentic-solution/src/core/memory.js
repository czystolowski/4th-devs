/**
 * Long-term memory system for agentic drone control
 * Supports episodic, semantic, and procedural memory types
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import log from "../helpers/logger.js";
import { memory as memoryConfig } from "../config.js";

/**
 * Memory store with three types:
 * - Episodic: What happened (events, actions, results)
 * - Semantic: What we know (facts, observations, verified data)
 * - Procedural: How to do things (procedures, patterns, learnings)
 */
class Memory {
  constructor(persistPath = memoryConfig.persistPath) {
    this.persistPath = persistPath;
    this.episodic = [];
    this.semantic = [];
    this.procedural = [];
    this.compressionHistory = [];
    
    this._ensureDirectory();
    this._load();
  }

  /**
   * Ensure memory directory exists
   * @private
   */
  _ensureDirectory() {
    if (!existsSync(this.persistPath)) {
      mkdirSync(this.persistPath, { recursive: true });
    }
  }

  /**
   * Load memory from disk
   * @private
   */
  _load() {
    const files = {
      episodic: join(this.persistPath, "episodic.json"),
      semantic: join(this.persistPath, "semantic.json"),
      procedural: join(this.persistPath, "procedural.json"),
      compressionHistory: join(this.persistPath, "compression-history.json")
    };

    for (const [type, file] of Object.entries(files)) {
      if (existsSync(file)) {
        try {
          const data = JSON.parse(readFileSync(file, "utf-8"));
          this[type] = data;
          log.memory(type, `Loaded ${data.length} entries`);
        } catch (error) {
          log.warning(`Failed to load ${type} memory: ${error.message}`);
        }
      }
    }
  }

  /**
   * Persist memory to disk
   * @private
   * @returns {boolean} True if all files persisted successfully
   */
  _persist() {
    const files = {
      episodic: join(this.persistPath, "episodic.json"),
      semantic: join(this.persistPath, "semantic.json"),
      procedural: join(this.persistPath, "procedural.json"),
      compressionHistory: join(this.persistPath, "compression-history.json")
    };

    let allSuccess = true;
    for (const [type, file] of Object.entries(files)) {
      try {
        writeFileSync(file, JSON.stringify(this[type], null, 2), "utf-8");
      } catch (error) {
        log.error(`Failed to persist ${type} memory`, error.message);
        allSuccess = false;
      }
    }
    return allSuccess;
  }

  /**
   * Store episodic memory (what happened)
   * @param {Object} episode - Episode data
   * @param {number} episode.episode - Episode number
   * @param {string} episode.agent - Agent name
   * @param {string} episode.action - Action taken
   * @param {string} episode.result - Result status
   * @param {*} [episode.data] - Additional data
   * @param {string} [episode.learning] - Learning extracted
   */
  storeEpisode(episode) {
    const entry = {
      id: `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...episode
    };

    this.episodic.push(entry);
    log.memory("episodic", `Stored episode ${episode.episode}: ${episode.action}`);
    
    this._checkCompressionThreshold();
    this._persist();
    
    return entry.id;
  }

  /**
   * Store semantic memory (what we know)
   * @param {Object} fact - Fact data
   * @param {string} fact.fact - Fact description
   * @param {*} fact.value - Fact value
   * @param {string} fact.confidence - Confidence level (low/medium/high)
   * @param {string} fact.source - Source agent
   * @param {boolean} [fact.verified] - Whether verified
   */
  storeFact(fact) {
    const entry = {
      id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      verified: false,
      ...fact
    };

    this.semantic.push(entry);
    log.memory("semantic", `Stored fact: ${fact.fact}`);
    
    this._persist();
    
    return entry.id;
  }

  /**
   * Store procedural memory (how to do things)
   * @param {Object} procedure - Procedure data
   * @param {string} procedure.procedure - Procedure name
   * @param {Array<string>} procedure.steps - Procedure steps
   * @param {string} [procedure.context] - When to use this procedure
   * @param {number} [procedure.successRate] - Success rate (0-1)
   */
  storeProcedure(procedure) {
    const entry = {
      id: `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      successRate: 0,
      ...procedure
    };

    this.procedural.push(entry);
    log.memory("procedural", `Stored procedure: ${procedure.procedure}`);
    
    this._persist();
    
    return entry.id;
  }

  /**
   * Recall episodic memories
   * @param {Object} [query] - Query filters
   * @param {string} [query.agent] - Filter by agent
   * @param {string} [query.action] - Filter by action
   * @param {number} [query.limit] - Limit results
   * @returns {Array} Matching episodes
   */
  recallEpisodes(query = {}) {
    let results = this.episodic;

    if (query.agent) {
      results = results.filter(ep => ep.agent === query.agent);
    }

    if (query.action) {
      results = results.filter(ep => ep.action === query.action);
    }

    if (query.limit) {
      results = results.slice(-query.limit);
    }

    return results;
  }

  /**
   * Recall semantic memories (facts)
   * @param {Object} [query] - Query filters
   * @param {string} [query.fact] - Filter by fact description (partial match)
   * @param {string} [query.source] - Filter by source agent
   * @param {boolean} [query.verified] - Filter by verification status
   * @returns {Array} Matching facts
   */
  recallFacts(query = {}) {
    let results = this.semantic;

    if (query.fact) {
      const searchTerm = query.fact.toLowerCase();
      results = results.filter(f => f.fact.toLowerCase().includes(searchTerm));
    }

    if (query.source) {
      results = results.filter(f => f.source === query.source);
    }

    if (query.verified !== undefined) {
      results = results.filter(f => f.verified === query.verified);
    }

    return results;
  }

  /**
   * Recall procedural memories
   * @param {Object} [query] - Query filters
   * @param {string} [query.procedure] - Filter by procedure name (partial match)
   * @param {string} [query.context] - Filter by context (partial match)
   * @returns {Array} Matching procedures
   */
  recallProcedures(query = {}) {
    let results = this.procedural;

    if (query.procedure) {
      const searchTerm = query.procedure.toLowerCase();
      results = results.filter(p => p.procedure.toLowerCase().includes(searchTerm));
    }

    if (query.context) {
      const searchTerm = query.context.toLowerCase();
      results = results.filter(p => 
        p.context && p.context.toLowerCase().includes(searchTerm)
      );
    }

    return results;
  }

  /**
   * Update existing memory entry
   * @param {string} id - Memory entry ID
   * @param {Object} updates - Fields to update
   * @returns {boolean} Success status
   */
  update(id, updates) {
    const types = ["episodic", "semantic", "procedural"];
    
    for (const type of types) {
      const index = this[type].findIndex(entry => entry.id === id);
      if (index !== -1) {
        this[type][index] = {
          ...this[type][index],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        
        log.memory(type, `Updated entry ${id}`);
        this._persist();
        return true;
      }
    }

    return false;
  }

  /**
   * Check if compression is needed
   * @private
   */
  _checkCompressionThreshold() {
    const totalEntries = this.episodic.length + this.semantic.length + this.procedural.length;
    
    if (totalEntries >= memoryConfig.compressionThreshold) {
      log.warning(`Memory threshold reached (${totalEntries}/${memoryConfig.compressionThreshold})`);
      log.info("Consider calling compress() to summarize old memories");
    }
  }

  /**
   * Compress old memories (to be implemented with AI summarization)
   * This is a placeholder for future AI-powered compression
   * @param {number} [keepRecent] - Number of recent entries to keep uncompressed
   * @returns {Object} Compression summary
   */
  compress(keepRecent = 10) {
    const compressionTimestamp = new Date().toISOString();
    
    // For now, just mark old entries as compressed
    // In full implementation, this would use AI to summarize
    const compressed = {
      timestamp: compressionTimestamp,
      episodicCount: Math.max(0, this.episodic.length - keepRecent),
      semanticCount: Math.max(0, this.semantic.length - keepRecent),
      proceduralCount: Math.max(0, this.procedural.length - keepRecent),
      summary: "Compression placeholder - implement AI summarization"
    };

    this.compressionHistory.push(compressed);
    
    log.memory("compression", `Compressed ${compressed.episodicCount + compressed.semanticCount + compressed.proceduralCount} entries`);
    
    this._persist();
    
    return compressed;
  }

  /**
   * Reflect on memories to extract patterns and learnings
   * This is a placeholder for AI-powered reflection
   * @returns {Object} Reflection insights
   */
  reflect() {
    const insights = {
      totalEpisodes: this.episodic.length,
      totalFacts: this.semantic.length,
      totalProcedures: this.procedural.length,
      verifiedFacts: this.semantic.filter(f => f.verified).length,
      recentErrors: this.episodic.filter(ep => 
        ep.result === "error" && 
        new Date(ep.timestamp) > new Date(Date.now() - 3600000) // Last hour
      ).length
    };

    log.memory("reflection", `Total: ${insights.totalEpisodes} episodes, ${insights.totalFacts} facts, ${insights.totalProcedures} procedures`);
    
    return insights;
  }

  /**
   * Clear all memory (use with caution)
   */
  clear() {
    this.episodic = [];
    this.semantic = [];
    this.procedural = [];
    this.compressionHistory = [];
    
    this._persist();
    
    log.warning("Memory cleared");
  }

  /**
   * Get memory statistics
   * @returns {Object} Memory stats
   */
  getStats() {
    return {
      episodic: this.episodic.length,
      semantic: this.semantic.length,
      procedural: this.procedural.length,
      compressions: this.compressionHistory.length,
      verifiedFacts: this.semantic.filter(f => f.verified).length
    };
  }
}

export default Memory;

// Made with Bob
