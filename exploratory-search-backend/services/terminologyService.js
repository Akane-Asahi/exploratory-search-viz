const { Paper } = require("../fetchData");

const normalize = (value) => (value || "")
  .toLowerCase()
  .replace(/[–—]/g, "-")
  .trim();

const BLACKLIST = new Set(
  [
    "Computer Science",
    "Research",
    "Paper",
    "Study",
    "Article"
  ].map((term) => term.toLowerCase())
);

const TOP_TERMS_LIMIT = 20;
const TREND_WINDOW_YEARS = 10;

function computeNicheScore(count) {
  return count / Math.log(count + 1);
}

async function getTopTerminologies(limit = TOP_TERMS_LIMIT) {
  const papers = await Paper.find({}, { tags: 1, primaryTopic: 1, year: 1 }).lean();
  const stats = new Map();
  const currentYear = new Date().getFullYear();
  const minTrendYear = currentYear - (TREND_WINDOW_YEARS - 1);
  const yearRange = Array.from({ length: TREND_WINDOW_YEARS }, (_, i) => minTrendYear + i);

  const applyTermToStats = (name, year) => {
    if (!stats.has(name)) {
      stats.set(name, {
        name,
        count: 0,
        trendByYear: yearRange.reduce((acc, y) => ({ ...acc, [y]: 0 }), {})
      });
    }

    const entry = stats.get(name);
    entry.count += 1;
    if (year >= minTrendYear && year <= currentYear) {
      entry.trendByYear[year] += 1;
    }
  };

  papers.forEach((paper) => {
    const year = Number(paper?.year || 0);
    const terms = [
      ...(paper.tags || []),
      paper.primaryTopic || ""
    ]
      .map((term) => (term || "").trim())
      .filter(Boolean);

    const uniqueTerms = [...new Set(terms)];
    uniqueTerms.forEach((name) => {
      if (BLACKLIST.has(name.toLowerCase())) return;
      applyTermToStats(name, year);
    });
  });

  const scored = Array.from(stats.values()).map((entry) => ({
    ...entry,
    nicheScore: computeNicheScore(entry.count)
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
