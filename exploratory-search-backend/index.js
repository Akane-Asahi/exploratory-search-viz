/*require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const paperSchema = new mongoose.Schema({
  title: String,
  year: Number,
  citationCount: Number,
  authors: [
    {
      authorId: String,
      name: String
    }
  ],
  concepts: [
    {
      name: String,
      level: Number,
      score: Number
    }
  ]
});

const Paper = mongoose.model("Paper", paperSchema);

app.get("/api/topics-by-year", async (req, res) => {
  try {
    const result = await Paper.aggregate([
      { $unwind: "$concepts" },
      {
        $group: {
          _id: { year: "$year", topic: "$concepts.name" },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.year",
          topics: {
            $push: {
              name: "$_id.topic",
              count: "$count"
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch(err => console.log(err));

// Paper Model (Must match Step 6)
const Paper = mongoose.model("Paper", new mongoose.Schema({
  title: String,
  year: Number,
  citationCount: Number,
  concepts: [{ name: String, level: Number, score: Number }]
}));

// --- ENDPOINTS ---

// 1. Papers by Year (For View 1: Timeline)
app.get("/api/trends", async (req, res) => {
  try {
    const data = await Paper.aggregate([
      { $group: { _id: "$year", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (err) { res.status(500).send(err); }
});

// 2. Top Cited (For View 2: Bar Chart)
app.get("/api/top-cited", async (req, res) => {
  try {
    const data = await Paper.find().sort({ citationCount: -1 }).limit(10);
    res.json(data);
  } catch (err) { res.status(500).send(err); }
});

// 3. Top Concepts (For View 3: Heatmap/Topics)
app.get("/api/concepts", async (req, res) => {
  try {
    const data = await Paper.aggregate([
      { $unwind: "$concepts" }, // Break array into individual items
      { $group: { _id: "$concepts.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);
    res.json(data);
  } catch (err) { res.status(500).send(err); }
});

// 4. Concept Evolution (For View 4: Line Chart)
app.get("/api/concept-evolution", async (req, res) => {
  try {
    const data = await Paper.aggregate([
      { $unwind: "$concepts" },
      // Filter for only the top-tier concepts you actually want
      { $match: { "concepts.name": { $in: ["Information retrieval", "Human–computer interaction", "Semantic search", "World Wide Web", "Information seeking"] } } },
      { $group: { 
          _id: { year: "$year", concept: "$concepts.name" }, 
          count: { $sum: 1 } 
      }},
      { $sort: { "_id.year": 1 } }
    ]);
    res.json(data);
  } catch (err) { res.status(500).send(err); }
});
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));