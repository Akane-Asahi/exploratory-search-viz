const { Paper } = require("../fetchData");

const normalize = (value) => (value || "").toString().trim().toLowerCase();

function buildTermSet(paper) {
  const keywords = (paper.keywords || []).map(normalize).filter(Boolean);
  const concepts = (paper.concepts || []).map((c) => normalize(c?.name)).filter(Boolean);
  return new Set([...keywords, ...concepts]);
}

function sharedCount(setA, setB) {
  let count = 0;
  setA.forEach((value) => {
    if (setB.has(value)) count += 1;
  });
  return count;
}

async function getPaperNetwork(limit = 20) {
  const safeLimit = Math.min(50, Math.max(5, Number(limit) || 20));
  const papers = await Paper.find(
    {},
    { title: 1, citationCount: 1, keywords: 1, concepts: 1, year: 1, venue: 1, openAlexUrl: 1, openAlexId: 1 }
  )
    .sort({ citationCount: -1 })
    .limit(safeLimit)
    .lean();

  const nodes = papers.map((paper, index) => ({
    id: `paper-${index + 1}`,
    title: paper.title || "Untitled",
    citationCount: Number(paper.citationCount || 0),
    keywords: (paper.keywords || []).filter(Boolean),
    concepts: (paper.concepts || []).map((c) => c?.name).filter(Boolean),
    year: paper.year || null,
    venue: paper.venue || "Unknown Venue",
    link: paper.openAlexUrl || paper.openAlexId || null
  }));

  const termSets = papers.map((paper) => buildTermSet(paper));
  const links = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const overlap = sharedCount(termSets[i], termSets[j]);
      if (overlap > 0) {
        links.push({
          source: nodes[i].id,
          target: nodes[j].id,
          weight: overlap
        });
      }
    }
  }

  return {
    nodes,
    links
  };
}

module.exports = {
  getPaperNetwork
};
