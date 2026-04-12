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

const TREND_WINDOW_YEARS = 10;

async function getTopTerminologies(limit = 0) {
  const papers = await Paper.find({}, { tags: 1, keywords: 1, primaryTopic: 1, year: 1 }).lean();
  const stats = new Map();
  const currentYear = new Date().getFullYear();
  const minTrendYear = currentYear - (TREND_WINDOW_YEARS - 1);
  const yearRange = Array.from({ length: TREND_WINDOW_YEARS }, (_, i) => minTrendYear + i);

  const applyTermToStats = (name, year) => {
    if (!stats.has(name)) {
      stats.set(name, {
        name,
        count: 0,
        lastCitedYear: 0,
        trendByYear: yearRange.reduce((acc, y) => ({ ...acc, [y]: 0 }), {})
      });
    }

    const entry = stats.get(name);
    entry.count += 1;
    if (Number.isFinite(year) && year > 0) {
      entry.lastCitedYear = Math.max(entry.lastCitedYear || 0, year);
    }
    if (year >= minTrendYear && year <= currentYear) {
      entry.trendByYear[year] += 1;
    }
  };

  papers.forEach((paper) => {
    const year = Number(paper?.year || 0);
    const terms = [
      ...(paper.tags || []),
      ...(paper.keywords || []),
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

  const allRankedTerms = Array.from(stats.values())
    .map((item) => ({
      name: item.name,
      count: item.count,
      lastCitedYear: Number(item.lastCitedYear || 0),
      trendScore: Number(item.count || 0) + (Number(item.lastCitedYear || 0) * 2),
      trend: yearRange.map((year) => item.trendByYear[year] || 0)
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

  const safeLimit = Number(limit);
  if (!Number.isFinite(safeLimit) || safeLimit <= 0) {
    return allRankedTerms;
  }
  return allRankedTerms.slice(0, Math.floor(safeLimit));
}

module.exports = {
  getTopTerminologies
};
