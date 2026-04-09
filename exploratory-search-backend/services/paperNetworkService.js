const { Paper } = require("../fetchData");

const normalize = (value) => (value || "").toString().trim().toLowerCase();

function buildTermMap(paper) {
  const map = new Map();
  const allTerms = [
    ...(paper.keywords || []),
    ...(paper.tags || []),
    paper.primaryTopic || ""
  ];

  allTerms.forEach((term) => {
    const raw = (term || "").toString().trim();
    const key = normalize(raw);
    if (!key) return;
    if (!map.has(key)) map.set(key, raw);
  });

  return map;
}

function getSharedTerms(mapA, mapB) {
  const shared = [];
  mapA.forEach((displayTerm, normalized) => {
    if (mapB.has(normalized)) shared.push(displayTerm);
  });
  return shared;
}

function getUniqueTerms(mapA, mapB) {
  const unique = [];
  mapA.forEach((displayTerm, normalized) => {
    if (!mapB.has(normalized)) unique.push(displayTerm);
  });
  return unique;
}

async function getPaperNetwork(limit = 0) {
  const requestedLimit = Number(limit);
  const safeLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.max(1, Math.floor(requestedLimit))
    : 0;
  
  // 1. Fetch papers including authors
  const papersQuery = Paper.find(
    {},
    { title: 1, citationCount: 1, keywords: 1, tags: 1, primaryTopic: 1, year: 1, venue: 1, openAlexUrl: 1, openAlexId: 1, referencedWorks: 1, authors: 1 }
  )
    .sort({ citationCount: -1 });
  if (safeLimit > 0) {
    papersQuery.limit(safeLimit);
  }
  const papers = await papersQuery.lean();

  // 2. Map nodes and format data for the frontend
  const nodes = papers.map((paper) => {
    
    // CRITICAL FIX: Extract author names from the array of objects and join them into a single string
    const authorNames = Array.isArray(paper.authors)
      ? paper.authors
          .map((a) => {
            if (typeof a === "string") return a;
            return a.name || a.display_name || "";
          })
          .filter(Boolean)
          .join(", ")
      : "";

    return {
      id: paper._id.toString(),
      openAlexId: paper.openAlexId || "",
      title: paper.title || "Unknown Title",
      year: paper.year || null,
      
      // CRITICAL FIX: Force safely parsed number to avoid NaN math errors
      citationCount: Number(paper.citationCount) || 0,
      
      venue: paper.venue || "Unknown Venue",
      openAlexUrl: paper.openAlexUrl || "",
      referencedWorks: paper.referencedWorks || [],
      tags: paper.tags || [],
      keywords: paper.keywords || [],
      primaryTopic: paper.primaryTopic || "",
      
      // Pass the fully joined string so the UI can render it instantly
      authors: authorNames 
    };
  });

  const termMaps = papers.map((paper) => buildTermMap(paper));
  const termMapByNodeId = new Map(nodes.map((node, idx) => [node.id, termMaps[idx]]));
  const terminologyLinks = [];
  const citationLinks = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const sharedTerms = getSharedTerms(termMaps[i], termMaps[j]);
      const overlap = sharedTerms.length;
      if (overlap > 0) {
        const sourceUniqueTerms = getUniqueTerms(termMaps[i], termMaps[j]).slice(0, 14);
        const targetUniqueTerms = getUniqueTerms(termMaps[j], termMaps[i]).slice(0, 14);
        terminologyLinks.push({
          source: nodes[i].id,
          target: nodes[j].id,
          weight: overlap,
          sharedTerms: sharedTerms.slice(0, 14),
          sourceUniqueTerms,
          targetUniqueTerms
        });
      }
    }
  }

  const nodeByOpenAlexId = new Map(
    nodes
      .filter((n) => n.openAlexId)
      .map((n) => [n.openAlexId, n])
  );
  const seenCitationEdges = new Set();

  nodes.forEach((sourceNode) => {
    (sourceNode.referencedWorks || []).forEach((refId) => {
      const citedNode = nodeByOpenAlexId.get(refId);
      if (!citedNode || citedNode.id === sourceNode.id) return;
      const key = `${sourceNode.id}=>${citedNode.id}`;
      if (seenCitationEdges.has(key)) return;
      seenCitationEdges.add(key);
      const sharedTerms = getSharedTerms(
        termMapByNodeId.get(sourceNode.id) || new Map(),
        termMapByNodeId.get(citedNode.id) || new Map()
      ).slice(0, 14);
      const sourceUniqueTerms = getUniqueTerms(
        termMapByNodeId.get(sourceNode.id) || new Map(),
        termMapByNodeId.get(citedNode.id) || new Map()
      ).slice(0, 14);
      const targetUniqueTerms = getUniqueTerms(
        termMapByNodeId.get(citedNode.id) || new Map(),
        termMapByNodeId.get(sourceNode.id) || new Map()
      ).slice(0, 14);
      citationLinks.push({
        source: sourceNode.id, // citing paper
        target: citedNode.id, // cited paper
        weight: 1,
        relation: "cites",
        citationYear: sourceNode.year || null,
        sourceTitle: sourceNode.title || sourceNode.id,
        targetTitle: citedNode.title || citedNode.id,
        sharedTerms,
        sourceUniqueTerms,
        targetUniqueTerms
      });
    });
  });

  return {
    nodes,
    links: terminologyLinks,
    terminologyLinks,
    citationLinks
  };
}

module.exports = {
  getPaperNetwork
};