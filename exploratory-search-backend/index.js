require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { fetchAndStore, Paper } = require("./fetchData");
const terminologyRoute = require("./routes/terminology");
const paperNetworkRoute = require("./routes/paperNetwork");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/terminology", terminologyRoute);
app.use("/api/paper-network", paperNetworkRoute);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

const getPaperTopics = (paper) => {
  const tags = (paper.tags || []).map((t) => (t || "").trim()).filter(Boolean);
  const primaryTopic = (paper.primaryTopic || "").trim();
  const keywords = (paper.keywords || []).map((k) => (k || "").trim()).filter(Boolean);
  return [...new Set([primaryTopic, ...tags, ...keywords].filter(Boolean))];
};

// --- HELPER: Format paper for frontend tables to fix authors and NaN errors ---
const formatPaperForFrontend = (paper) => {
  const authorsArray = Array.isArray(paper.authors)
    ? paper.authors
        .map((a) => {
          if (typeof a === "string") return { authorId: "", name: a };
          return {
            authorId: a?.authorId || a?.id || "",
            name: a?.name || a?.display_name || ""
          };
        })
        .filter((a) => a.name)
    : [];

  return {
    ...paper,
    authors: authorsArray,
    citationCount: Number(paper.citationCount) || 0 // Force a clean number
  };
};

// --- ENDPOINTS ---

// 1. Papers by Year (Timeline)
app.get("/api/trends", async (req, res) => {
  try {
    const data = await Paper.aggregate([
      { $group: { _id: "$year", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Top Cited (Bar Chart & Table)
app.get("/api/top-cited", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 0;
    
    // ADDED .lean() and the formatting map!
    const rawPapers = await Paper.find().sort({ citationCount: -1 }).limit(limit).lean();
    const formattedPapers = rawPapers.map(formatPaperForFrontend);
    
    res.json(formattedPapers);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 3. Top Tags (General Overview - Updated to use tags instead of deprecated concepts)
app.get("/api/concepts", async (req, res) => {
  try {
    const data = await Paper.aggregate([
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Dashboard Summary Stats
app.get("/api/papers/dashboard-stats", async (req, res) => {
  try {
    const totalPapers = await Paper.countDocuments();
    
    if (totalPapers === 0) {
      return res.json({ 
        stats: { totalPapers: 0, avgCitations: 0, uniqueVenues: 0, topTag: "N/A", topicData: [], networkData: { nodes: [], links: [] } }, 
        topPapers: [] 
      });
    }

    // Averages and Unique Venues
    const basicStatsAgg = await Paper.aggregate([
      {
        $group: {
          _id: null,
          avgCitations: { $avg: "$citationCount" },
          venues: { $addToSet: "$venue" }
        }
      }
    ]);
    
    // Force a clean number for the average, rounded to 1 decimal place
    let avgCitations = basicStatsAgg[0]?.avgCitations || 0;
    if (isNaN(avgCitations) || avgCitations === null) avgCitations = 0;
    avgCitations = Number(avgCitations.toFixed(1)); 

    const uniqueVenues = basicStatsAgg[0]?.venues?.length || 0;

    // Top Topics for the Bar Chart
    const topicData = await Paper.aggregate([
      { $match: { primaryTopic: { $ne: "" } } },
      { $group: { _id: "$primaryTopic", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
      { $project: { name: "$_id", value: "$count", _id: 0 } }
    ]);

    // Most common tag
    const topTagAgg = await Paper.aggregate([
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const topTag = topTagAgg[0]?._id || "N/A";

    // Top 10 Most Cited Papers for the Table
    // ADDED .lean() and the formatting map!
    const rawTopPapers = await Paper.find()
      .sort({ citationCount: -1 })
      .limit(10)
      .lean();
    const topPapers = rawTopPapers.map(formatPaperForFrontend);

    res.json({
      stats: {
        totalPapers,
        avgCitations,
        uniqueVenues,
        topTag,
        topicData,
        networkData: { nodes: [], links: [] }
      },
      topPapers
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ error: "Failed to aggregate dashboard data" });
  }
});


// Topic timeline: top N subtopics, publication count per year
app.get("/api/topic-timeline", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const papers = await Paper.find({}, { year: 1, tags: 1, primaryTopic: 1, keywords: 1 }).lean();
    const map = new Map();
    papers.forEach((paper) => {
      const year = Number(paper.year || 0);
      if (!year) return;
      const topics = getPaperTopics(paper);
      topics.forEach((topic) => {
        const key = `${year}__${topic}`;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    const rawData = Array.from(map.entries()).map(([key, count]) => {
      const [year, concept] = key.split("__");
      return { _id: { year: Number(year), concept }, count };
    });

    const totals = {};
    rawData.forEach(d => {
      totals[d._id.concept] = (totals[d._id.concept] || 0) + d.count;
    });

    const topConcepts = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(e => e[0]);

    const filtered = rawData
      .filter(d => topConcepts.includes(d._id.concept))
      .map(d => ({ year: d._id.year, concept: d._id.concept, count: d.count }));

    res.json({ concepts: topConcepts, data: filtered });
  } catch (err) {
    console.error("Topic timeline error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Fetch progress tracking ---
let fetchProgress = { saved: 0, total: 10000, status: 'idle', error: null };

app.post("/api/trigger-fetch", (req, res) => {
  const searchTerm = (req.body?.searchTerm || "").trim();
  const category = req.body?.category || "All Computer Science";
  const sortBy = req.body?.sortBy || "relevance";

  if (!searchTerm) {
    return res.status(400).json({ success: false, error: "Search term is required" });
  }

  fetchProgress = { saved: 0, total: "Calculating...", status: 'fetching', error: null };
  res.json({ success: true, message: "Fetch started" });

  // Pass the correct arguments matching the updated fetchData.js
  fetchAndStore(searchTerm, (progress) => {
    fetchProgress = progress;
  }, category, sortBy)
    .then(() => console.log(`Background fetch for "${searchTerm}" complete.`))
    .catch(err => {
      fetchProgress = { saved: 0, total: 0, status: 'error', error: err.message };
      console.error("Background fetch error:", err);
    });
});

app.get("/api/fetch-status", (req, res) => {
  res.json(fetchProgress);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));