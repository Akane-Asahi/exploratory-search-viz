const { Paper } = require("../fetchData");

const normalize = (value) => (value || "")
  .toLowerCase()
  .replace(/[–—]/g, "-")
  .trim();

const BLACKLIST = new Set(
  [
    "Computer Science",
    "Artificial Intelligence",
    "Medicine",
    "Biology",
    "Psychology",
    "Human",
    "Male",
    "Female",
    "MEDLINE",
    "Research",
    "Psychiatry",
    "Mental health",
    "Human",
    "Male",
    "Female",
    "Patient",
    "Clinical",
    "Schizophrenia",
    "Anxiety",
    "Psychosis"
  ].map((term) => term.toLowerCase())
);

const ALLOWED_ANCESTOR_TERMS = [
  "Computer Science"
].map(normalize);

const EXCLUDED_ANCESTOR_TERMS = [
  "Psychology",
  "Medicine",
  "Biology",
  "Psychiatry",
  "Archaeology",
  "Physics",
  "MEDLINE"
].map(normalize);

const TOP_TERMS_LIMIT = 20;
const TREND_WINDOW_YEARS = 10;

function computeNicheScore(totalScore, count) {
  return totalScore / Math.log(count + 1);
}

function getNormalizedAncestors(concept) {
  return (concept?.ancestors || [])
    .map((a) => normalize(a))
    .filter(Boolean);
}

function hasExcludedAncestor(concept) {
  const ancestors = getNormalizedAncestors(concept);
  return ancestors.some((ancestor) =>
    EXCLUDED_ANCESTOR_TERMS.some((blocked) => ancestor.includes(blocked))
  );
}

function isDomainRelevant(concept) {
  const ancestors = getNormalizedAncestors(concept);

  if (ancestors.length === 0) return false;

  if (hasExcludedAncestor(concept)) return false;

  const hasAllowedAncestor = ancestors.some((ancestor) =>
    ALLOWED_ANCESTOR_TERMS.some((allowed) => ancestor.includes(allowed))
  );
  return hasAllowedAncestor;
}

async function getTopTerminologies(limit = TOP_TERMS_LIMIT) {
  const papers = await Paper.find({}, { concepts: 1, year: 1 }).lean();
  const strictStats = new Map();
  const fallbackStats = new Map();
  const currentYear = new Date().getFullYear();
  const minTrendYear = currentYear - (TREND_WINDOW_YEARS - 1);
  const yearRange = Array.from({ length: TREND_WINDOW_YEARS }, (_, i) => minTrendYear + i);

  const applyConceptToStats = (statsMap, name, conceptScore, year) => {
    if (!statsMap.has(name)) {
      statsMap.set(name, {
        name,
        totalScore: 0,
        count: 0,
        trendByYear: yearRange.reduce((acc, y) => ({ ...acc, [y]: 0 }), {})
      });
    }

    const entry = statsMap.get(name);
    entry.totalScore += Number(conceptScore || 0);
    entry.count += 1;
    if (year >= minTrendYear && year <= currentYear) {
      entry.trendByYear[year] += 1;
    }
  };

  papers.forEach((paper) => {
    const year = Number(paper?.year || 0);

    (paper.concepts || []).forEach((concept) => {
      const name = (concept?.name || "").trim();
      if (!name) return;
      if (BLACKLIST.has(name.toLowerCase())) return;

      // Strict mode keeps CS-only terminology quality high.
      if (isDomainRelevant(concept)) {
        applyConceptToStats(strictStats, name, concept?.score, year);
      }

      // Fallback avoids an empty ranked table when strict ancestors are sparse.
      if (!hasExcludedAncestor(concept)) {
        applyConceptToStats(fallbackStats, name, concept?.score, year);
      }
    });
  });

  const chosenStats = strictStats.size > 0 ? strictStats : fallbackStats;
  const scored = Array.from(chosenStats.values()).map((entry) => ({
    ...entry,
    nicheScore: computeNicheScore(entry.totalScore, entry.count)
  }));

  const highestScore = scored.reduce((max, item) => Math.max(max, item.nicheScore), 0);

  return scored
    .map((item) => ({
      name: item.name,
      score: highestScore > 0 ? Number((item.nicheScore / highestScore).toFixed(4)) : 0,
      count: item.count,
      trend: yearRange.map((year) => item.trendByYear[year] || 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = {
  getTopTerminologies,
  computeNicheScore
};
