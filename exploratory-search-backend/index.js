require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { fetchAndStore, Paper } = require("./fetchData"); // Import Model here
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

// 2. Top Cited (Bar Chart)
app.get("/api/top-cited", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));
    const data = await Paper.find().sort({ citationCount: -1 }).limit(limit);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Top Concepts (General Overview)
app.get("/api/concepts", async (req, res) => {
  try {
    
    const data = await Paper.aggregate([
      { $unwind: "$concepts" },
      { $group: { _id: "$concepts.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/keywords", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));
    const data = await Paper.aggregate([
      { $unwind: "$keywords" },
      { $group: { _id: "$keywords", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit}
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Concept Evolution (Stacked Area Chart)
app.get("/api/concept-evolution", async (req, res) => {
  try {
    const data = await Paper.aggregate([
      { $unwind: "$concepts" },
      { $match: { "concepts.name": { $in: ["Information retrieval", "Human–computer interaction", "Semantic search", "World Wide Web", "Information seeking"] } } },
      { $group: {  
          _id: { year: "$year", concept: "$concepts.name" }, 
          count: { $sum: 1 } 
      }},
      { $sort: { "_id.year": 1 } }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/concept-matrix', async (req, res) => {
    try {
        const papers = await Paper.find({});
        const concepts = ["Information retrieval", "World Wide Web", "Information seeking", "Human–computer interaction", "Semantic search"];
        
        let matrix = [];
        concepts.forEach(c1 => {
            concepts.forEach(c2 => {
                // Count papers that have BOTH concepts in their array
                const count = papers.filter(p => 
                    p.concepts.some(pc => pc.name === c1) && 
                    p.concepts.some(pc => pc.name === c2)
                ).length;
                
                matrix.push({ topicA: c1, topicB: c2, count: count });
            });
        });
        res.json(matrix);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/api/concept-velocity', async (req, res) => {
    try {
        const rawData = await Paper.aggregate([
            { $unwind: "$concepts" },
            { $group: { 
                _id: { year: "$year", concept: "$concepts.name" },
                count: { $sum: 1 }
            }}
        ]);

        const currentYear = 2025;
        const concepts = ["Information retrieval", "World Wide Web", "Information seeking", "Human–computer interaction", "Semantic search"];
        
        const velocityData = concepts.map(c => {
            const recent = rawData.filter(d => d._id.concept === c && d._id.year >= currentYear - 2);
            const older = rawData.filter(d => d._id.concept === c && d._id.year < currentYear - 2);
            
            // FIX: Use standard JavaScript reduce instead of d3.mean
            const recentSum = recent.reduce((acc, curr) => acc + curr.count, 0);
            const recentAvg = recent.length > 0 ? recentSum / recent.length : 0;

            const olderSum = older.reduce((acc, curr) => acc + curr.count, 0);
            const olderAvg = older.length > 0 ? olderSum / older.length : 1; // Avoid div by zero
            
            const growth = ((recentAvg - olderAvg) / olderAvg) * 100;
            return { concept: c, velocity: growth };
        });

        res.json(velocityData);
    } catch (err) {
        console.error("Velocity Calculation Error:", err);
        res.status(500).json({ error: "Could not calculate velocity" });
    }
});

// Topic timeline: top N subtopics, publication count per year
app.get("/api/topic-timeline", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

    const rawData = await Paper.aggregate([
      { $unwind: "$concepts" },
      { $group: {
        _id: { year: "$year", concept: "$concepts.name" },
        count: { $sum: 1 }
      }}
    ]);

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

// Dashboard summary stats
app.get("/api/dashboard-stats", async (req, res) => {
  try {
    const papers = await Paper.find({});
    const totalPapers = papers.length;

    const keywordSet = new Set();
    const terminologySet = new Set();
    papers.forEach((paper) => {
      (paper.keywords || []).forEach((keyword) => {
        const normalized = (keyword || "").trim();
        if (normalized) keywordSet.add(normalized.toLowerCase());
      });
      (paper.concepts || []).forEach((concept) => {
        const normalized = (concept?.name || "").trim();
        if (normalized) terminologySet.add(normalized.toLowerCase());
      });
    });

    res.json({
      totalPapers,
      activeConcepts: terminologySet.size,
      totalKeywords: keywordSet.size,
      totalTerminologies: terminologySet.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Fetch progress tracking ---
let fetchProgress = { saved: 0, total: 10000, status: 'idle', error: null };

app.post("/api/trigger-fetch", (req, res) => {
  const searchTerm = (req.body?.searchTerm || "").trim();
  const totalPapers = Math.min(10000, Math.max(100, parseInt(req.body?.totalPapers, 10) || 10000));
  const searchMode = req.body?.searchMode === "keyword" ? "keyword" : "semantic";
  if (!searchTerm) {
    return res.status(400).json({ success: false, error: "Search term is required" });
  }

  fetchProgress = { saved: 0, total: totalPapers, status: 'fetching', error: null };
  res.json({ success: true, message: "Fetch started" });

  fetchAndStore(searchTerm, totalPapers, (progress) => {
    fetchProgress = progress;
  }, searchMode)
    .then(() => console.log(`Background fetch for "${searchTerm}" complete.`))
    .catch(err => {
      fetchProgress = { saved: 0, total: 10000, status: 'error', error: err.message };
      console.error("Background fetch error:", err);
    });
});

app.get("/api/fetch-status", (req, res) => {
  res.json(fetchProgress);
});

// ... Keep your other routes (timeline, cited, heatmap) but add the Level 2 match stage to them!

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
