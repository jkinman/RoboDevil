#!/usr/bin/env node
/**
 * Hybrid Skill Loader
 * Handles both simple JSON-declarative skills and complex Node.js skills
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class HybridSkillLoader {
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
    this.simpleSkills = new Map();
    this.nodeSkills = new Map();
    this.config = null;
  }

  async load() {
    const configPath = path.join(this.skillsDir, 'skills.json');
    
    if (!fs.existsSync(configPath)) {
      console.error('❌ skills.json not found');
      return false;
    }

    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Load simple (JSON) skills
    for (const [name, skill] of Object.entries(this.config.simpleSkills || {})) {
      this.simpleSkills.set(name, skill);
      console.log(`📄 Simple skill loaded: ${name}`);
    }

    // Load complex (Node.js) skills
    for (const [name, skill] of Object.entries(this.config.nodeSkills || {})) {
      const skillPath = path.join(this.skillsDir, skill.file);
      
      if (fs.existsSync(skillPath)) {
        try {
          // Clear require cache for hot-reloading
          delete require.cache[require.resolve(skillPath)];
          const nodeSkill = require(skillPath);
          
          this.nodeSkills.set(name, {
            ...skill,
            execute: nodeSkill.execute || nodeSkill.default?.execute
          });
          console.log(`⚙️  Node skill loaded: ${name}`);
        } catch (err) {
          console.error(`❌ Failed to load ${name}: ${err.message}`);
        }
      } else {
        console.warn(`⚠️  Skill file not found: ${skill.file}`);
      }
    }

    return true;
  }

  async execute(command, context) {
    const cmdLower = command.toLowerCase();

    // Try simple skills first (faster)
    for (const [name, skill] of this.simpleSkills) {
      if (skill.patterns.some(p => cmdLower.includes(p.toLowerCase()))) {
        console.log(`📄 Simple skill matched: ${name}`);
        return this.renderSimpleResponse(skill.response, context);
      }
    }

    // Try Node.js skills
    for (const [name, skill] of this.nodeSkills) {
      if (skill.patterns.some(p => cmdLower.includes(p.toLowerCase()))) {
        console.log(`⚙️  Node skill matched: ${name}`);
        
        if (skill.execute) {
          try {
            const result = await skill.execute(command, context);
            return result;
          } catch (err) {
            console.error(`❌ Skill ${name} failed: ${err.message}`);
            return `Sorry, I had trouble with that.`;
          }
        }
      }
    }

    return null; // No skill matched
  }

  renderSimpleResponse(template, context) {
    // Simple template replacement
    return template
      .replace(/{time:(.+?)}/g, (match, format) => {
        return new Date().toLocaleTimeString('en-US', {
          hour12: true,
          hour: 'numeric',
          minute: '2-digit'
        });
      })
      .replace(/{date:(.+?)}/g, (match, format) => {
        return new Date().toLocaleDateString();
      });
  }

  listSkills() {
    const simple = Array.from(this.simpleSkills.keys());
    const node = Array.from(this.nodeSkills.keys());
    
    return {
      simple: simple.map(name => ({
        name,
        ...this.simpleSkills.get(name)
      })),
      node: node.map(name => ({
        name,
        ...this.nodeSkills.get(name)
      }))
    };
  }
}

module.exports = { HybridSkillLoader };
