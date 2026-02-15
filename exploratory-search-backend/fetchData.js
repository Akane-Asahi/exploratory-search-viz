require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");

// 1. Define the Schema (How the data will look in Mongo)
const paperSchema = new mongoose.Schema({
  title: String,
  year: Number,
  citationCount: Number,
  authors: [{ authorId: String, name: String }],
  concepts: [{ name: String, level: Number, score: Number }]
});

const Paper = mongoose.model("Paper", paperSchema);

async function fetchAndStore() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to Mongo. Starting fetch...");

    // 2. Fetch from OpenAlex
    const response = await axios.get("https://api.openalex.org/works", {
      params: {
        search: "exploratory search",
        filter: "from_publication_date:2000-01-01,language:en",
        "per-page": 200,
        mailto: process.env.USER_EMAIL
      }
    });

    const works = response.data.results;
    console.log(`Fetched ${works.length} papers. Saving to database...`);

    // 3. Map and Save
    const formattedPapers = works.map(work => ({
      title: work.display_name,
      year: work.publication_year,
      citationCount: work.cited_by_count,
      authors: work.authorships.map(a => ({
        authorId: a.author?.id || "",
        name: a.author?.display_name || ""
      })),
      concepts: (work.concepts || []).slice(0, 5).map(c => ({
        name: c.display_name,
        level: c.level,
        score: c.score
      }))
    }));

    await Paper.insertMany(formattedPapers);
    console.log("✅ Day 1 Complete: 200 papers stored in Atlas!");
    process.exit();

  } catch (error) {
    console.error("Error during fetch:", error.message);
    process.exit(1);
  }
}

fetchAndStore();