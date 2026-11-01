/**
 * Questline System
 * 
 * Modular quest manager supporting Discovery, Reaction, and Synthesis quest types.
 * Tracks progress, awards Star points, unlocks tools, and triggers rank progression.
 */

export const QUEST_TYPES = {
  DISCOVERY: 'discovery',
  REACTION: 'reaction',
  SYNTHESIS: 'synthesis',
};

export const QUEST_STATUS = {
  LOCKED: 'locked',
  ACTIVE: 'active',
  COMPLETED: 'completed',
};

export class QuestManager {
  constructor() {
    this.quests = new Map();
    this.completedQuests = new Set();
    this.listeners = new Map();
    this.stars = 0;
    this.loadProgress();
    this.initializeDefaultQuests();
  }

  /**
   * Initialize default questline
   */
  initializeDefaultQuests() {
    const defaultQuests = [
      // Discovery quests
      {
        id: 'disc_water',
        type: QUEST_TYPES.DISCOVERY,
        title: 'First Molecule',
        description: 'Discover water (H₂O)',
        target: 'H2O',
        reward: { stars: 1, unlock: null },
        prerequisite: null,
      },
      {
        id: 'disc_ammonia',
        type: QUEST_TYPES.DISCOVERY,
        title: 'Nitrogen Chemistry',
        description: 'Discover ammonia (NH₃)',
        target: 'NH3',
        reward: { stars: 1, unlock: null },
        prerequisite: 'disc_water',
      },
      {
        id: 'disc_methane',
        type: QUEST_TYPES.DISCOVERY,
        title: 'Organic Beginnings',
        description: 'Discover methane (CH₄)',
        target: 'CH4',
        reward: { stars: 1, unlock: null },
        prerequisite: 'disc_water',
      },
      {
        id: 'disc_co2',
        type: QUEST_TYPES.DISCOVERY,
        title: 'Carbon Cycle',
        description: 'Discover carbon dioxide (CO₂)',
        target: 'CO2',
        reward: { stars: 1, unlock: null },
        prerequisite: 'disc_methane',
      },
      {
        id: 'disc_ethanol',
        type: QUEST_TYPES.DISCOVERY,
        title: 'Alcohol Chemistry',
        description: 'Discover ethanol (C₂H₅OH)',
        target: 'C2H6O',
        reward: { stars: 2, unlock: 'advanced_bonds' },
        prerequisite: 'disc_methane',
      },
      {
        id: 'disc_glucose',
        type: QUEST_TYPES.DISCOVERY,
        title: 'Sugar Rush',
        description: 'Discover glucose (C₆H₁₂O₆)',
        target: 'C6H12O6',
        reward: { stars: 5, unlock: 'biochemistry' },
        prerequisite: 'disc_ethanol',
      },
      // Reaction quests
      {
        id: 'rxn_combustion',
        type: QUEST_TYPES.REACTION,
        title: 'Fire Starter',
        description: 'Perform a combustion reaction',
        target: 'combustion',
        reward: { stars: 2, unlock: null },
        prerequisite: 'disc_methane',
      },
      {
        id: 'rxn_neutralization',
        type: QUEST_TYPES.REACTION,
        title: 'Acid-Base Master',
        description: 'Perform a neutralization reaction',
        target: 'neutralization',
        reward: { stars: 2, unlock: null },
        prerequisite: 'disc_water',
      },
      {
        id: 'rxn_redox',
        type: QUEST_TYPES.REACTION,
        title: 'Electron Transfer',
        description: 'Perform a redox reaction',
        target: 'redox',
        reward: { stars: 3, unlock: 'electrochemistry' },
        prerequisite: 'rxn_neutralization',
      },
      // Synthesis quests
      {
        id: 'synth_salt',
        type: QUEST_TYPES.SYNTHESIS,
        title: 'Seasoning',
        description: 'Synthesize sodium chloride (NaCl)',
        target: 'NaCl',
        reward: { stars: 1, unlock: null },
        prerequisite: null,
      },
      {
        id: 'synth_sulfuric',
        type: QUEST_TYPES.SYNTHESIS,
        title: 'Industrial Chemist',
        description: 'Synthesize sulfuric acid (H₂SO₄)',
        target: 'H2SO4',
        reward: { stars: 3, unlock: 'industrial' },
        prerequisite: 'disc_co2',
      },
    ];

    for (const quest of defaultQuests) {
      this.quests.set(quest.id, {
        ...quest,
        status: QUEST_STATUS.LOCKED,
        progress: 0,
      });
    }

    this.updateQuestAvailability();
  }

  /**
   * Update quest availability based on prerequisites
   */
  updateQuestAvailability() {
    for (const [id, quest] of this.quests) {
      if (this.completedQuests.has(id)) {
        quest.status = QUEST_STATUS.COMPLETED;
        continue;
      }

      if (!quest.prerequisite) {
        quest.status = QUEST_STATUS.ACTIVE;
      } else if (this.completedQuests.has(quest.prerequisite)) {
        quest.status = QUEST_STATUS.ACTIVE;
      } else {
        quest.status = QUEST_STATUS.LOCKED;
      }
    }
  }

  /**
   * Check if a discovery quest is completed
   */
  checkDiscovery(formula) {
    for (const [id, quest] of this.quests) {
      if (quest.type === QUEST_TYPES.DISCOVERY && quest.target === formula) {
        this.completeQuest(id);
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a reaction quest is completed
   */
  checkReaction(reactionType) {
    for (const [id, quest] of this.quests) {
      if (quest.type === QUEST_TYPES.REACTION && quest.target === reactionType) {
        this.completeQuest(id);
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a synthesis quest is completed
   */
  checkSynthesis(formula) {
    for (const [id, quest] of this.quests) {
      if (quest.type === QUEST_TYPES.SYNTHESIS && quest.target === formula) {
        this.completeQuest(id);
        return true;
      }
    }
    return false;
  }

  /**
   * Complete a quest and award rewards
   */
  completeQuest(questId) {
    const quest = this.quests.get(questId);
    if (!quest || quest.status === QUEST_STATUS.COMPLETED) return false;
    if (quest.status !== QUEST_STATUS.ACTIVE) return false;

    quest.status = QUEST_STATUS.COMPLETED;
    quest.progress = 100;
    this.completedQuests.add(questId);

    // Award stars
    if (quest.reward.stars) {
      this.stars += quest.reward.stars;
    }

    // Emit completion event
    this.emit('questCompleted', { quest, rewards: quest.reward });

    // Update availability for dependent quests
    this.updateQuestAvailability();

    // Save progress
    this.saveProgress();

    return true;
  }

  /**
   * Get all quests
   */
  getAllQuests() {
    return Array.from(this.quests.values());
  }

  /**
   * Get active quests
   */
  getActiveQuests() {
    return this.getAllQuests().filter(q => q.status === QUEST_STATUS.ACTIVE);
  }

  /**
   * Get completed quests
   */
  getCompletedQuests() {
    return this.getAllQuests().filter(q => q.status === QUEST_STATUS.COMPLETED);
  }

  /**
   * Get locked quests
   */
  getLockedQuests() {
    return this.getAllQuests().filter(q => q.status === QUEST_STATUS.LOCKED);
  }

  /**
   * Get total stars earned
   */
  getStars() {
    return this.stars;
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Emit event
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (e) {
        console.error(`Quest event handler error: ${e}`);
      }
    }
  }

  /**
   * Save progress to localStorage
   */
  saveProgress() {
    try {
      const data = {
        completed: Array.from(this.completedQuests),
        stars: this.stars,
      };
      localStorage.setItem('mol3d.quests', JSON.stringify(data));
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Load progress from localStorage
   */
  loadProgress() {
    try {
      const data = JSON.parse(localStorage.getItem('mol3d.quests'));
      if (data) {
        this.completedQuests = new Set(data.completed || []);
        this.stars = data.stars || 0;
      }
    } catch {
      // Storage unavailable or corrupted
    }
  }

  /**
   * Reset all progress
   */
  reset() {
    this.completedQuests.clear();
    this.stars = 0;
    for (const quest of this.quests.values()) {
      quest.status = QUEST_STATUS.LOCKED;
      quest.progress = 0;
    }
    this.updateQuestAvailability();
    this.saveProgress();
  }
}

// Export singleton instance
export const questManager = new QuestManager();
