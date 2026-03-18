require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");

const normalize = (value) => (value || "")
  .toString()
  .toLowerCase()
  .replace(/[–—]/g, "-")
  .trim();

const hasComputerScienceAncestor = (concept) =>
  (concept?.ancestors || []).some((ancestor) =>
    normalize(ancestor?.display_name || ancestor?.name || "").includes("computer science")
  );

const EXCLUDED_DOMAIN_TERMS = [
  "medicine",
  "biology",
  "psychology",
  "psychiatry",
  "archaeology",
  "physics",
  "medline"
];

const hasExcludedDomainAncestor = (concept) =>
  (concept?.ancestors || []).some((ancestor) => {
    const normalizedAncestor = normalize(ancestor?.display_name || ancestor?.name || "");
    return EXCLUDED_DOMAIN_TERMS.some((term) => normalizedAncestor.includes(term));
  });

const paperSchema = new mongoose.Schema({
  openAlexId: String,
  openAlexUrl: String,
  doi: String,
  title: String,
  year: Number,
  citationCount: Number,
  timeBucket: String,
  venue: String,
  authors: [{ authorId: String, name: String }],
  keywords: [String],
  concepts: [{ 
    name: String, 
    level: Number, 
    score: Number,
    ancestors: [String]
  }]
});

// Create the model
const Paper = mongoose.model("Paper", paperSchema);

// Helper function to handle retries for API stability
async function axiosWithRetry(config, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios(config);
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
      if (isTimeout && i < retries - 1) {
        console.log(`⚠️ Timeout reached. Retrying page... (Attempt ${i + 2}/${retries})`);
        await new Promise(res => setTimeout(res, 2000)); // Wait 2s before retry
        continue;
      }
      throw err;
    }
  }
}

async function fetchAndStore(searchTerm, totalPapers = 10000, onProgress, searchMode = "semantic") {
  if (!searchTerm) return { success: false, message: "No search term provided" };
  const total = Math.min(10000, Math.max(100, totalPapers));
  const normalizedMode = searchMode === "keyword" ? "keyword" : "semantic";
  const effectiveTotal = normalizedMode === "semantic" ? Math.min(total, 50) : total;
  const report = (saved, status, error) => {
    if (onProgress) onProgress({ saved, total: effectiveTotal, status, error: error || null });
  };

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    await Paper.deleteMany({});
    report(0, 'fetching');

    let totalSaved = 0;
    const currentYear = new Date().getFullYear();

    console.log(`📡 Starting ${normalizedMode} fetch for: "${searchTerm}"`);

    const toPaperDocs = (works) => works.reduce((docs, work) => {
      const allConcepts = (work.concepts || []).filter((c) => c.level >= 2);
      const containsExcludedDomain = allConcepts.some((c) => hasExcludedDomainAncestor(c));
      if (containsExcludedDomain) return docs;

      const csConcepts = (work.concepts || [])
        .filter((c) => c.level >= 2 && hasComputerScienceAncestor(c))
        .map((c) => ({
          name: c.display_name,
          level: c.level,
          score: c.score,
          ancestors: (c.ancestors || [])
            .map((a) => a?.display_name || a?.name || "")
            .filter(Boolean)
        }));

      // Keep only papers that contain at least one computer-science concept.
      if (csConcepts.length === 0) return docs;

      docs.push({
        openAlexId: work.id || "",
        openAlexUrl:
          work.primary_location?.landing_page_url ||
          work.primary_location?.source?.homepage_url ||
          "",
        doi: work.doi || "",
        title: work.display_name,
        year: work.publication_year,
        citationCount: work.cited_by_count,
        timeBucket:
          work.publication_year >= currentYear - 1
            ? "recent"
            : work.publication_year >= currentYear - 6
              ? "historical"
              : "outside_window",
        venue:
          work.primary_location?.source?.display_name ||
          work.host_venue?.display_name ||
          "Unknown Venue",
        authors: (work.authorships || []).map(a => ({
          authorId: a.author?.id || "",
          name: a.author?.display_name || ""
        })),
        keywords: (work.keywords || [])
          .map((k) => k?.display_name || k?.keyword || "")
          .filter(Boolean),
        concepts: csConcepts
      });

      return docs;
    }, []);

    if (normalizedMode === "semantic") {
      const response = await axiosWithRetry({
        method: "get",
        url: "https://api.openalex.org/works",
        params: {
          "search.semantic": searchTerm,
          // Semantic search supports a narrower set of filters.
          filter: "language:en",
          "per-page": 50,
          page: 1,
          mailto: process.env.USER_EMAIL || "user@example.com"
        },
        timeout: 60000
      });

      const works = (response.data.results || []).filter(
        (work) => (work.publication_year || 0) >= 2010
      );
      const pagePapers = toPaperDocs(works).slice(0, effectiveTotal);
      if (pagePapers.length > 0) {
        await Paper.insertMany(pagePapers);
      }
      totalSaved = pagePapers.length;
      console.log(`✅ Saved ${totalSaved} papers...`);
      report(totalSaved, "fetching");
    } else {
      let nextCursor = "*";

      while (nextCursor) {
        const response = await axiosWithRetry({
          method: "get",
          url: "https://api.openalex.org/works",
          params: {
            search: searchTerm,
            filter: "from_publication_date:2010-01-01,language:en",
            "per-page": 200,
            cursor: nextCursor,
            mailto: process.env.USER_EMAIL || "user@example.com"
          },
          timeout: 60000
        });

        const works = response.data.results;
        if (!works || works.length === 0) break;

        const pagePapers = toPaperDocs(works);
        await Paper.insertMany(pagePapers);
        totalSaved += pagePapers.length;
        console.log(`✅ Saved ${totalSaved} papers...`);
        report(totalSaved, "fetching");

        nextCursor = response.data.meta.next_cursor;
        if (totalSaved >= effectiveTotal) break;
      }
    }

    console.log("🚀 Data Refresh Complete!");
    report(totalSaved, 'done');
    return { success: true, count: totalSaved };

  } catch (error) {
    console.error("❌ Final Fetch Error:", error.message);
    report(0, 'error', error.message);
    return { success: false, error: error.message };
  }
}

// Export BOTH the function and the Model for index.js
module.exports = { fetchAndStore, Paper };