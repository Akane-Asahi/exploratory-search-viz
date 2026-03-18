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

function isDomainRelevant(concept) {
  const ancestors = (concept?.ancestors || [])
    .map((a) => normalize(a))
    .filter(Boolean);

  if (ancestors.length === 0) return false;

  const hasExcludedAncestor = ancestors.some((ancestor) =>
    EXCLUDED_ANCESTOR_TERMS.some((blocked) => ancestor.includes(blocked))
  );
  if (hasExcludedAncestor) return false;

  const hasAllowedAncestor = ancestors.some((ancestor) =>
    ALLOWED_ANCESTOR_TERMS.some((allowed) => ancestor.includes(allowed))
  );
  return hasAllowedAncestor;
}

async function getTopTerminologies(limit = TOP_TERMS_LIMIT) {
  const papers = await Paper.find({}, { concepts: 1, year: 1 }).lean();
  const stats = new Map();
  const currentYear = new Date().getFullYear();
  const minTrendYear = currentYear - (TREND_WINDOW_YEARS - 1);
  const yearRange = Array.from({ length: TREND_WINDOW_YEARS }, (_, i) => minTrendYear + i);

  papers.forEach((paper) => {
    const year = Number(paper?.year || 0);

    (paper.concepts || []).forEach((concept) => {
      const name = (concept?.name || "").trim();
      if (!name) return;
      if (!isDomainRelevant(concept)) return;
      if (BLACKLIST.has(name.toLowerCase())) return;

      if (!stats.has(name)) {
        stats.set(name, {
          name,
          totalScore: 0,
          count: 0,
          trendByYear: yearRange.reduce((acc, y) => ({ ...acc, [y]: 0 }), {})
        });
      }

      const entry = stats.get(name);
      entry.totalScore += Number(concept?.score || 0);
      entry.count += 1;
      if (year >= minTrendYear && year <= currentYear) {
        entry.trendByYear[year] += 1;
      }
    });
  });

  const scored = Array.from(stats.values()).map((entry) => ({
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
