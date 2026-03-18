# Dashboard Design Specification

After a user performs a search, the system navigates to a **Dashboard page** that visualizes the research landscape for the query.

The dashboard is organized into **two main rows**.

---

# Layout Structure

## Row 1

Row 1 contains **two columns**.

### Right Column – Semantic Terminology Treemap

Visualization: **Treemap**

Purpose:
Display the major semantic terminologies extracted from the retrieved papers.

Data Source:
OpenAlex concepts + extracted key phrases from abstracts.

Each treemap tile represents a terminology.

Tile size:
number of papers containing the term

Tile color:
average citation impact

Interaction:
hover → show statistics

term
paper count
total citations
average year

Clicking a tile filters the dashboard by that terminology.

---

### Left Column

The left column is divided into **two rows**.

---

# Left Column – Row 1

This row contains **two columns**.

---

### Column 1 – Terminology Analytics Table

Table displaying semantic search terms extracted from the literature.

Columns:

Term
Semantic Score
Paper Count
Total Citations
Mini Bar Chart

Semantic Score calculation:

semantic_score =
0.5 * concept_frequency

* 0.3 * semantic_similarity_to_query
* 0.2 * citation_weight

The **mini bar chart** shows the number of papers associated with the term.

The table supports:

sorting
filtering
term selection

Selecting a term filters other visualizations.

---

### Column 2 – Terminology Growth Chart

Visualization: **Line Chart**

Purpose:
Show how the popularity of a search term evolves over time.

X-axis:
publication year

Y-axis:
number of papers

Multiple lines can be shown for selected terms.

Insight example:

Metacognition → steady growth
LLM-assisted search → rapid recent growth

---

# Left Column – Row 2

This row contains **two columns**.

---

# Column 1 – Research Frontier Map System

Purpose:
Help users visually explore research landscapes and identify emerging research topics.

This component is an **interactive research map**.

Each paper is represented as a node in a 2D space.

Distance between nodes indicates **semantic similarity**.

---

## Research Frontier System Workflow

### Step 1 – Search

User query example:

exploratory search

Backend queries OpenAlex API.

---

### Step 2 – Data Collection

Retrieve paper metadata:

title
abstract
concepts
citation count
publication year
referenced works

Store results in MongoDB.

---

### Step 3 – Semantic Representation

Each paper is converted into a vector embedding.

Embedding model:

SentenceTransformers

Input:

title + abstract

This produces a vector representation of the paper.

---

### Step 4 – Dimensionality Reduction

Embeddings are reduced to 2D coordinates using:

UMAP
or
t-SNE

Result:

paper → (x,y)

This creates a spatial research map.

---

### Step 5 – Topic Clustering

Use clustering algorithm:

HDBSCAN

Clusters represent research topics.

Example clusters:

Information Retrieval
Visualization
Human Computer Interaction
AI-assisted Search

---

### Step 6 – Frontier Detection

A **Frontier Score** identifies emerging research areas.

Frontier Score combines:

recent publication growth
recent citation growth
novelty relative to existing clusters

Formula:

frontier_score =
0.4 * publication_growth

* 0.3 * citation_growth
* 0.3 * novelty_score

Clusters with the highest scores are labeled **Research Frontiers**.

Example frontier:

LLM-assisted exploratory search

---

### Step 7 – Visualization

Frontend visualization displays:

node = paper
distance = semantic similarity
color = topic cluster
size = citation impact
highlight = frontier cluster

User interactions:

zoom
pan
hover details
click paper
explore cluster

Recommended library:

D3.js force simulation or WebGL scatterplot.

---

# Column 2 – Citation Flow Sankey Diagram

Visualization: **Sankey Diagram**

Purpose:
Show citation flow between papers containing different semantic terminologies.

Nodes represent:

semantic terms or paper clusters.

Edges represent:

citations between those groups.

Edge width:

number of citations.

Example insight:

Metacognition papers → cited by → AI-assisted learning papers

This helps reveal **knowledge transfer across research topics**.

---

# Technologies

Frontend:

React (Vite)
TailwindCSS
D3.js
Recharts
react-sankey or d3-sankey

Backend:

Node.js
Express

Database:

MongoDB

ML Processing:

SentenceTransformers
UMAP or t-SNE
HDBSCAN

External API:

OpenAlex
