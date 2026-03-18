CS837 Project Onboarding Guide (Windows + Mac)
1) What this project is
This repo has 2 apps:

exploratory-search-backend → Node.js + Express + MongoDB API
exploratory-search-frontend → React dashboard UI
Flow:

User searches on Home page.
Backend fetches papers from OpenAlex and stores in MongoDB (Paper collection).
Dashboard reads processed endpoints (stats, terminology, graph, top papers) and renders visualizations.
2) One-time setup (both OS)
Requirements
Node.js 18+ (or 20 LTS recommended)
npm
MongoDB connection string (from your teammate/project owner)
.env file in backend folder
Backend .env example
Create exploratory-search-backend/.env:

MONGO_URI=your_mongodb_connection_string
USER_EMAIL=your_email@example.com
PORT=5000
USER_EMAIL is used for OpenAlex polite-pool requests.

3) Run locally
Windows (PowerShell)
# Terminal 1
cd exploratory-search-backend
npm install
node index.js
# Terminal 2
cd exploratory-search-frontend
npm install
npm start
Mac (Terminal / zsh)
# Terminal 1
cd exploratory-search-backend
npm install
node index.js
# Terminal 2
cd exploratory-search-frontend
npm install
npm start
Frontend: http://localhost:3000
Backend: http://localhost:5000

4) Data model your teammates should know
Main stored object is a paper in MongoDB (Paper), with key fields:

title
year
citationCount
venue
authors[] (authorId, name)
keywords[]
concepts[]:
name
level
score
ancestors[]
openAlexId, openAlexUrl, doi
Important behavior: every new fetch currently refreshes dataset (old papers are cleared and replaced).

5) Current dashboard endpoints (used by UI)
POST /api/trigger-fetch → start fetch
GET /api/fetch-status → progress polling
GET /api/dashboard-stats
GET /api/topic-timeline?limit=8
GET /api/terminology
GET /api/paper-network?limit=20
GET /api/top-cited?limit=20
6) How a teammate should add their own visualization row
Use this exact process to avoid breaking existing code.

Step A — Create a new component file
In frontend src/, create:

MemberAChart.jsx (or your own name)
Example skeleton:

import React from 'react';
function MemberAChart({ data }) {
  return <div>{/* your chart */}</div>;
}
export default MemberAChart;
Step B — Add a backend endpoint (if needed)
If your chart needs new transformed data:

Add route in backend index.js (or in a separate route/service file)
Return clean JSON shape
Test quickly in browser/Postman
Example:

app.get("/api/member-a-data", async (req, res) => {
  // compute from Paper.find(...)
  res.json(result);
});
Step C — Fetch in DashboardPage.jsx
Add state for your data
Add fetch in existing Promise.allSettled
Pass data to your component
Pattern:

const [memberAData, setMemberAData] = useState([]);
const res = await axios.get("http://localhost:5000/api/member-a-data");
setMemberAData(res.data);
Step D — Add a new row/card block
In DashboardPage.jsx, add a new panel at bottom (same panelStyle) and render your component.

7) Team-safe workflow (very important)
Each teammate should use their own branch:

git checkout -b feature/member-name-chart
Then:

git add .
git commit -m "add Member X dashboard chart"
git push origin feature/member-name-chart
Then open PR and merge after review.

8) Common mistakes to avoid
Do not edit another teammate’s chart file unless agreed.
Do not hardcode URLs other than http://localhost:5000 in development.
Do not commit generated build folders (dist, build).
If stats look wrong, re-run fetch from Home page and wait until /api/fetch-status shows done.
9) Quick “first task” for each teammate
Pull latest branch.
Run backend + frontend.
Trigger one fetch from Home page.
Confirm dashboard loads.
Add one small chart component with its own API endpoint.
Commit only your files.