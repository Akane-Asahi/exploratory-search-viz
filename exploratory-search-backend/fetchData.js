require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");

const normalize = (value) => (value || "")
  .toString()
  .toLowerCase()
  .replace(/[–—]/g, "-")
  .trim();

const CATEGORY_FILTER_MAP = {
  "All Computer Science": "topics.field.id:fields/17",
  "AI & Machine Learning": "topics.subfield.id:subfields/1702",
  "HCI & Visualization": "topics.subfield.id:subfields/1709", 
  "Information Retrieval & Search": "topics.subfield.id:subfields/1710",
  "Software Engineering": "topics.subfield.id:subfields/1712",
  "Computer Graphics": "topics.subfield.id:subfields/1704",
  "Theoretical Computer Science": "topics.subfield.id:subfields/1703", 
  "Computer Networks & Comm": "topics.subfield.id:subfields/1705",
  "Computer Security & Reliability": "topics.subfield.id:subfields/1702",
  "Database Management Systems": "topics.subfield.id:subfields/1706"
};

const passesQualityThresholds = (work) => {
  const title = work.display_name || work.title || "";
  if (!title || title.length < 5) return false;
  if (!work.authorships || work.authorships.length === 0) return false;
  // We relax the abstract requirement for older foundational papers
  return true; 
};

function normalizeMath(text = "") {
  return text
    
    .replace(/\\ensuremath\{(.*?)\}/g, "$1")

    
    .replace(/\/spl Theta\//g, "Θ")
    .replace(/\/spl radic\//g, "√")

    
    .replace(/\\delta/g, "δ")
    .replace(/\\theta/g, "θ")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β");
}

const paperSchema = new mongoose.Schema({
  openAlexId: { type: String, unique: true },
  openAlexUrl: String,
  doi: String,
  title: String,
  year: Number,
  citationCount: Number,
  timeBucket: String,
  venue: String,
  abstract: String,
  authors: [{ authorId: String, name: String }],
  keywords: [String],
  primaryTopic: String,
  tags: [String],
  referencedWorks: [String],
  concepts: [{ 
    name: String, 
    level: Number, 
    score: Number,
    ancestors: [String]
  }],
  citationsByYear: [{
    year: Number,
    count: Number
  }]
});

const Paper = mongoose.models.Paper || mongoose.model("Paper", paperSchema);

async function axiosWithRetry(config, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios(config);
    } catch (err) {
      if (err.response?.status === 429) {
        console.warn(`⚠️ Rate limited. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries reached");
}

async function fetchAndStore(searchTerm, onProgress, category = "All Computer Science") {
  if (!searchTerm) return { success: false, message: "No search term provided" };
  
  const mappedCategory = CATEGORY_FILTER_MAP[category] || CATEGORY_FILTER_MAP["All Computer Science"];
  const apiFilter = `${mappedCategory},language:en`;

  const report = (saved, total, status, error) => {
    if (onProgress) onProgress({ saved, total, status, error: error || null });
  };
  
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    await Paper.deleteMany({});
    report(0, "Locating Seed Papers...", 'fetching');

    const currentYear = new Date().getFullYear();
    const mailto = process.env.USER_EMAIL || "";

    // -------------------------------------------------------------
    // STEP 1: Fetch Top 3 "Seed" Papers based on the search term
    // -------------------------------------------------------------
    console.log(`\n🌱 Fetching Seed Papers for: "${searchTerm}"`);
    const seedResponse = await axiosWithRetry({
      method: "get",
      url: "https://api.openalex.org/works",
      params: {
        search: `"${searchTerm}"`, 
        filter: apiFilter,
        sort: "relevance_score:desc,cited_by_count:desc",
        "per-page": 3,
        mailto
      }
    });

    const seedWorks = seedResponse.data.results || [];
    if (seedWorks.length === 0) {
      console.log("No seed papers found.");
      report(0, 0, 'done');
      return { success: true, count: 0 };
    }

    const seedIds = seedWorks.map(w => w.id.replace('https://openalex.org/', ''));
    let allWorksMap = new Map(); // Use a map to deduplicate papers by ID

    // Add seeds to our map
    seedWorks.forEach(w => allWorksMap.set(w.id, w));

    // -------------------------------------------------------------
    // STEP 2: Fetch Papers that CITE the seeds (Descendants)
    // -------------------------------------------------------------
    report(seedWorks.length, "Fetching citations...", 'fetching');
    console.log(`🌿 Fetching papers that cite the seeds...`);
    
    // Create an OR filter for citations: cites:W123|cites:W456
    const citeFilter = seedIds.map(id => `${id}`).join('|');
    
    const citingResponse = await axiosWithRetry({
      method: "get",
      url: "https://api.openalex.org/works",
      params: {
        filter: `cites:${citeFilter},language:en`,
        sort: "cited_by_count:desc",
        "per-page": 100, // Top 100 most cited papers that cite our seeds
        mailto
      }
    });

    (citingResponse.data.results || []).forEach(w => allWorksMap.set(w.id, w));

    // -------------------------------------------------------------
    // STEP 3: Fetch Papers referenced BY the seeds (Ancestors)
    // -------------------------------------------------------------
    report(allWorksMap.size, "Fetching references...", 'fetching');
    console.log(`🌳 Fetching foundational papers referenced by seeds...`);

    let referencedIds = new Set();
    seedWorks.forEach(seed => {
      (seed.referenced_works || []).forEach(ref => {
         referencedIds.add(ref.replace('https://openalex.org/', ''));
      });
    });

    // Take top 100 references to avoid payload size limits
    const refArray = Array.from(referencedIds).slice(0, 100); 

    if (refArray.length > 0) {
        // We chunk the IDs because OpenAlex URL limits can drop requests if filter string is too long
        const chunkedRefs = refArray.slice(0, 50).join('|');
        const refResponse = await axiosWithRetry({
            method: "get",
            url: "https://api.openalex.org/works",
            params: {
              filter: `openalex:${chunkedRefs}`,
              "per-page": 50,
              mailto
            }
        });
        (refResponse.data.results || []).forEach(w => allWorksMap.set(w.id, w));
    }

    // -------------------------------------------------------------
    // STEP 4: Format and Save to Database
    // -------------------------------------------------------------
    console.log(`💾 Formatting and saving ${allWorksMap.size} interconnected papers...`);
    
    const toPaperDocs = (worksArray) => worksArray.reduce((docs, work) => {
      if (!passesQualityThresholds(work)) return docs;
      
      const topicTags = (work.topics || []).map((t) => t?.display_name || "").filter(Boolean);
      
      // CRITICAL FIX: Only extract highly specific concepts (Level 2 or higher)
      // This prevents "Computer science" (Level 0) from flooding your tags array
      const conceptTags = (work.concepts || [])
        .filter(c => c.level >= 2) 
        .map(c => c?.display_name || "")
        .filter(Boolean);
      
      // Stop known generic noise from even making it into MongoDB
      const noiseWords = new Set(["computer science", "uncategorized", "research", "paper", "study"]);
      
      // Bumped the slice to 10 to give your specific topics more breathing room
      let tags = [...new Set([...topicTags, ...conceptTags])]
        .filter(tag => !noiseWords.has(tag.toLowerCase()))
        .slice(0, 10); 
      
      if (tags.length === 0) tags = [work.primary_topic?.display_name || "Unknown Topic"];
      const abstract = work?.abstract_inverted_index ? Object.entries(work.abstract_inverted_index).reduce((acc, [word,pos]) => {
        pos.forEach(p => acc[p] = normalizeMath(word));
        return acc;
        }, [])
        .join(" ")
        : "";
     
      
      docs.push({
        openAlexId: work.id || "",
        openAlexUrl: work.primary_location?.landing_page_url || "",
        
        doi: work.doi || "",
        title: work.display_name,
        year: work.publication_year,
        citationCount: Number(work.cited_by_count || 0),
        timeBucket: work.publication_year >= currentYear - 2 ? "recent" : "historical",
        venue: work.primary_location?.source?.display_name || "Unknown Venue",
        abstract: abstract,
        
        authors: (work.authorships || [])
          .map((a) => ({
            authorId: a.author?.id || "",
            name: a.author?.display_name || "",
            
          }))
          .filter((a) => a.name),
        keywords: (work.keywords || []).map((k) => k?.display_name || "").filter(Boolean).slice(0, 10),
        primaryTopic: work.primary_topic?.display_name || "Unknown Topic",
        tags: tags, 
        referencedWorks: (work.referenced_works || []).filter(Boolean),
        citationsByYear: (work.counts_by_year || []).map(a => ({
          year: a?.year,
          count: a?.cited_by_count
        })),
      });
      return docs;
    }, []);

    const papersToSave = toPaperDocs(Array.from(allWorksMap.values()));

    if (papersToSave.length > 0) {
      await Paper.insertMany(papersToSave);
    }

    console.log(`🚀 Snowball Fetch Complete! Saved ${papersToSave.length} connected papers.`);
    report(papersToSave.length, papersToSave.length, 'done');
    return { success: true, count: papersToSave.length };

  } catch (error) {
    console.error("❌ Fetch Error:", error.message);
    report(0, 0, 'error', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { fetchAndStore, Paper };