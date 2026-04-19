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

let db; 

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Database Connected");
    db = mongoose.connection.db; 
  })
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

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
            name: a?.name || a?.display_name || "",
            
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




app.put("/api/insert-favorite-paper/:searchTerm", async (req, res) => {
  try {
    const searchTerm = req.params.searchTerm;
    const { papers } = req.body;
    

    const result = await db.collection("favorite-papers").updateOne(
      { searchTerm },
      { $set: { papers } },
      { upsert: true }
    );

    console.log(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/favorite-paper/:searchTerm", async (req, res) => {
  try {
    const searchTerm = req.params.searchTerm;

    const doc = await db.collection("favorite-papers").findOne({ searchTerm });
    
    if (!doc || !doc.papers?.length) {
      return res.json({ papers: [] });
    }
    
    const papers = await Paper.find({ 
      openAlexId: { $in: doc.papers } 
    }).lean();

    res.json({ papers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/insert-favorite-term/:searchTerm", async (req, res) => {
  try {
    
    const searchTerm = req.params.searchTerm;
    const { terms } = req.body;
    
    const result = await db.collection("favorite-terms").updateOne(
      { searchTerm },
      { $set: { terms } },
      { upsert: true }
    );
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/favorite-term/:searchTerm", async (req, res) => {
  try {
    const searchTerm = req.params.searchTerm;
    
    
    const doc = await db.collection("favorite-terms").findOne({ searchTerm });
    

    if (!doc) {
      return res.json({ terms: [] });
    }

    res.json({ terms: doc.terms || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
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





app.get("/api/authors", async (req, res) => {
  try {
    
    const data = await Paper.aggregate([
      { $unwind: "$authors" },
      { $group: { _id: "$authors.name", count: { $sum: 1 }, citations: { $sum: "$citationCount" } } },
      { $sort: { count: -1 } },
      { $limit: 25 }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/paper-authors/:id", async (req, res) => {
  try {
    
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ error: "Paper not found" });
    const authorNames = paper.authors.map(a => a.name);

    const data = await Paper.aggregate([
      { $match: { "authors.name": { $in: authorNames } } },
      { $unwind: "$authors" },
      { $match: { "authors.name": { $in: authorNames } } },
      { $group: { _id: "$authors.name",  count: { $sum: 1 }, citations: {$sum: "$citationCount" } }},
      { $sort: { count: -1 } },
      
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
 
app.get("/api/coauthors/:name", async (req, res) => {
  try {
  
   
    
    const authorName = req.params.name;
   
    
    
    //const author = paper.authors.map(a => a.name);

    const data = await Paper.aggregate([
      { $match: { "authors.name": authorName } },
      { $unwind: "$authors" },
      { $match: { "authors.name": { $ne: authorName } } },
      {
        $group: {
          _id: "$authors.name",
          count: { $sum: 1 },
          citations: {$sum: "$citationCount"}
          
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/author-papers/:name", async (req, res) => {
  try {
  
   
   
    const authorName = req.params.name;
    
    const data = await Paper.aggregate([
      
      { $match: { "authors.name": authorName } },
      {$sort: {citationCount: -1}}
      
      
    ]);
    
    
    
    
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/author-citation/:name", async (req, res) => {
  try {
  
   
  
    const authorName = req.params.name;
    
    const data = await Paper.aggregate([
      
      { $match: { "authors.name": authorName } },

      
      { $unwind: "$citationsByYear" },

      {
        $group: {
          _id: "$citationsByYear.year",
          count: { $sum: "$citationsByYear.count" }
        }
      },
      {
        $project: {
          _id: 0,
          year: "$_id",
          count: 1
        }
      },
      

      { $sort: { count: 1 } }
    ]);
    
    const currentYear = new Date().getFullYear();
    const years = data.map(d => d.year);
    const startYear = Math.min(...years);

    const map = new Map(data.map(d => [d.year, d.count]));

    const filled = [];
    for (let y = startYear; y <= currentYear; y++) {
      filled.push({ year: y, count: map.get(y) ?? 0 });
    }
    
    
    res.json(filled);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/yearly-citations/:id", async (req, res) => {
  try {
    
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const currentYear = new Date().getFullYear();
    const startYear = paper.year || 2000;
    const map = new Map((paper.citationsByYear || []).map(d => [d.year, d.count]));

    const filled = [];
    for (let year = startYear; year <= currentYear; year++) {
      filled.push({ year, count: map.get(year) ?? 0 });
    }

    res.json(filled);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.get("/api/closest-papers/:id", async (req, res) => {
  try {
    
    function getSimilarity(paper1,paper2){
      let similarity = 0;
      const factorA = 1;
      const authors1 = (paper1.authors || []).map(a => a.name);
      const authors2 = new Set((paper2.authors || []).map(a => a.name));

      for (let i = 0; i < authors1.length; i++) {
        if (authors2.has(authors1[i])) {
          similarity += factorA;
        }
      }
      if (paper1?.primaryTopic == paper2?.primaryTopic) similarity += 1
      const concepts1 = (paper1.tags || []);
      const concepts2 = new Set((paper2.tags || []));
      const factorC = .5;
      for (let i = 0; i < concepts1.length; i++) {
        if (concepts2.has(concepts1[i])) {
          similarity += factorC;
        }
      }

      const keywords1 = (paper1.keywords || []);
      const keywords2 = new Set((paper2.keywords || []));
      const factorK = .2;
      for (let i = 0; i < keywords1.length; i++) {
        if (keywords2.has(keywords1[i])) {
          similarity += factorK;
        }
      }
      
      

      const citations1 = (paper1.referencedWorks || []);
      const citations2 = new Set((paper2.referencedWorks || []));
      
      
      const factorCite = .05;
      for (let i = 0; i < citations1.length; i++) {
        if (citations2.has(citations1[i])) {
          similarity += factorCite;
          
        }
      }
      similarity /= (
        (authors1.length + authors2.size) * factorA +
        (concepts1.length + concepts2.size) * factorC +
        (keywords1.length + keywords2.size) * factorK +
        (citations1.length + citations2.size) * factorCite +
        1);
      
      return similarity;
    } 
    const paper = await Paper.findById(req.params.id);
    
    const paperConcepts = paper.concepts.map(c => ({ name: c.name, score: c.score }));
    const paperConceptNames = paperConcepts.map(c => c.name);

    const papers = await Paper.find({
      _id: { $ne: paper._id }
    }).lean();

  const scored = papers.map(p => ({
    ...p,
    sharedScore: getSimilarity(paper, p)
  }));

  const data = scored
    .filter(p => p.sharedScore > 0)
    .sort((a, b) => b.sharedScore - a.sharedScore)
    .slice(0, 15);
    
    res.json(data);
    } catch (err) { 
      res.status(500).json({ error: err.message }); 
    }
    });

app.get("/api/tags", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));
    const data = await Paper.aggregate([
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit}
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));