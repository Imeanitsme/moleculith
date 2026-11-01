/**
 * Rank-Up System
 * 
 * FC Mobile-style progression with ranks, grades, stars, and shield visuals.
 * Every molecule discovered = +1 Star. 5 Stars = 1 Grade.
 * Ranks: New Creation → Talented → Low Intermediate → Experienced → Researcher → Further Beyond
 */

export const RANKS = [
  {
    id: 'new_creation',
    name: 'New Creation',
    grades: 5,
    image: './rank/NewCreation.png',
    textColor: '#1a5c2e',
  },
  {
    id: 'talented',
    name: 'Talented',
    grades: 5,
    image: './rank/Talented.png',
    textColor: '#1a4a6e',
  },
  {
    id: 'low_intermediate',
    name: 'Low Intermediate',
    grades: 5,
    image: './rank/LowInter.png',
    textColor: '#ffffff',
  },
  {
    id: 'experienced',
    name: 'Experienced',
    grades: 5,
    image: './rank/Experienced.png',
    textColor: '#ffffff',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    grades: 5,
    image: './rank/Researcher.png',
    textColor: '#ffffff',
  },
  {
    id: 'further_beyond',
    name: 'Further Beyond',
    grades: 5,
    image: './rank/FurtherBeyond.png',
    textColor: '#ffd700',
    sparkle: true,
  },
];

const STARS_PER_GRADE = 5;

const ROMAN_NUMERALS = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

export function toRoman(n) {
  if (n <= 0) return '0';
  if (n <= 20) return ROMAN_NUMERALS[n];
  // For larger numbers, build manually
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  let remaining = n;
  for (let i = 0; i < vals.length; i++) {
    while (remaining >= vals[i]) {
      result += syms[i];
      remaining -= vals[i];
    }
  }
  return result;
}

/**
 * Calculate rank and grade from total stars
 */
export function getRankFromStars(totalStars) {
  let remaining = totalStars;
  
  for (let r = 0; r < RANKS.length; r++) {
    const rank = RANKS[r];
    const rankStars = rank.grades * STARS_PER_GRADE;
    
    if (remaining < rankStars || r === RANKS.length - 1) {
      const grade = Math.floor(remaining / STARS_PER_GRADE) + 1;
      const starsInGrade = remaining % STARS_PER_GRADE;
      const maxGrade = rank.grades === Infinity ? grade : rank.grades;
      
      return {
        rank,
        rankIndex: r,
        grade: Math.min(grade, maxGrade),
        gradeRoman: toRoman(Math.min(grade, maxGrade)),
        starsInGrade,
        totalStars,
        nextGradeStars: STARS_PER_GRADE - starsInGrade,
        isMaxGrade: rank.grades !== Infinity && grade >= rank.grades,
      };
    }
    
    remaining -= rankStars;
  }
  
  // Should never reach here
  return {
    rank: RANKS[0],
    rankIndex: 0,
    grade: 1,
    gradeRoman: 'I',
    starsInGrade: 0,
    totalStars,
    nextGradeStars: STARS_PER_GRADE,
    isMaxGrade: false,
  };
}

/**
 * Rank manager with persistence and event system
 */
export class RankManager {
  constructor() {
    this.totalStars = 0;
    this.previousRank = null;
    this.listeners = new Map();
    this.loadProgress();
    this.previousRank = this.getCurrentRank();
  }

  /**
   * Add stars (e.g., from discovering a molecule)
   */
  addStars(count) {
    const oldRank = this.getCurrentRank();
    this.totalStars += count;
    const newRank = this.getCurrentRank();
    
    // Check for grade-up
    if (newRank.grade > oldRank.grade || newRank.rankIndex > oldRank.rankIndex) {
      this.emit('gradeUp', {
        oldRank,
        newRank,
        isRankUp: newRank.rankIndex > oldRank.rankIndex,
      });
    }
    
    this.emit('starsChanged', { totalStars: this.totalStars, rank: newRank });
    this.saveProgress();
    
    return newRank;
  }

  /**
   * Get current rank info
   */
  getCurrentRank() {
    return getRankFromStars(this.totalStars);
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
      try { cb(data); } catch (e) { console.error(`Rank event handler error: ${e}`); }
    }
  }

  /**
   * Save progress
   */
  saveProgress() {
    try {
      localStorage.setItem('mol3d.rank', JSON.stringify({ totalStars: this.totalStars }));
    } catch { /* storage unavailable */ }
  }

  /**
   * Load progress
   */
  loadProgress() {
    try {
      const data = JSON.parse(localStorage.getItem('mol3d.rank'));
      if (data) this.totalStars = data.totalStars || 0;
    } catch { /* corrupted or unavailable */ }
  }

  /**
   * Reset progress
   */
  reset() {
    this.totalStars = 0;
    this.saveProgress();
    this.emit('starsChanged', { totalStars: 0, rank: this.getCurrentRank() });
  }
}

export const rankManager = new RankManager();

// Element unlocking by rank
// Tier 1 (New Creation): Common non-metals + first 20 elements
// Tier 2 (Talented): Up to Z=36 (Krypton)
// Tier 3 (Low Intermediate): Up to Z=54 (Xenon)
// Tier 4 (Experienced): Up to Z=86 (Radon)
// Tier 5 (Researcher): All 118 elements
// Tier 6 (Further Beyond): All 118 elements + console
const ELEMENT_TIERS = {
  new_creation: 20,
  talented: 36,
  low_intermediate: 54,
  experienced: 86,
  researcher: 118,
  further_beyond: 118,
};

export function isElementUnlocked(z, rankInfo) {
  const maxZ = ELEMENT_TIERS[rankInfo.rank.id] || 20;
  return z <= maxZ;
}

export function getUnlockedElementCount(rankInfo) {
  return ELEMENT_TIERS[rankInfo.rank.id] || 20;
}

const FEATURE_RANKS = {
  mayhem: 'experienced',
  console: 'further_beyond',
};

export function isFeatureUnlocked(feature, rankInfo) {
  const requiredRankId = FEATURE_RANKS[feature];
  if (!requiredRankId) return true;
  const requiredIdx = RANKS.findIndex(r => r.id === requiredRankId);
  return rankInfo.rankIndex >= requiredIdx;
}

export function getRequiredRankForFeature(feature) {
  const id = FEATURE_RANKS[feature];
  if (!id) return null;
  return RANKS.find(r => r.id === id);
}

// Daily rewards system
const DAILY_REWARD_KEY = 'mol3d.dailyReward';
const DAILY_STREAK_KEY = 'mol3d.dailyStreak';

export function checkDailyReward() {
  const today = new Date().toDateString();
  let lastClaim = null;
  let streak = 0;
  
  try {
    const data = JSON.parse(localStorage.getItem(DAILY_REWARD_KEY));
    if (data) lastClaim = data.lastClaim;
    streak = parseInt(localStorage.getItem(DAILY_STREAK_KEY)) || 0;
  } catch {}
  
  if (lastClaim === today) return null; // Already claimed today
  
  // Check if consecutive day
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (lastClaim === yesterday) {
    streak++;
  } else {
    streak = 1; // Reset streak
  }
  
  // Reward increases with streak (1-5 stars)
  const stars = Math.min(streak, 5);
  
  return { streak, stars };
}

export function claimDailyReward() {
  const today = new Date().toDateString();
  const reward = checkDailyReward();
  if (!reward) return null;
  
  try {
    localStorage.setItem(DAILY_REWARD_KEY, JSON.stringify({ lastClaim: today }));
    localStorage.setItem(DAILY_STREAK_KEY, reward.streak.toString());
  } catch {}
  
  // Add stars to rank
  rankManager.addStars(reward.stars);
  
  return reward;
}

export function getDailyStreak() {
  try {
    return parseInt(localStorage.getItem(DAILY_STREAK_KEY)) || 0;
  } catch {
    return 0;
  }
}
