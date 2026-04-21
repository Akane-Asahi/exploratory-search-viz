# Exploratory Search Visualization

This project has two applications:
- `exploratory-search-backend`: Node.js + Express API connected to MongoDB
- `exploratory-search-frontend`: React app for search and dashboard visualization

---

## Live link in Vercel
Click here - [Your Next Research](https://exploratory-search-viz-7ndk-8dbeb2gxo-alams-projects-ca39ebe6.vercel.app/)

---

## First-Time Setup (Professor Machine)

### 1) Prerequisites

Install these first:
- [Node.js](https://nodejs.org/) 18+ (Node 20 LTS recommended)
- `npm` (comes with Node.js)
- Internet access (backend fetches data from OpenAlex)
- MongoDB connection string (`MONGO_URI`)

---

### 2) Clone Repository

```bash
git clone <YOUR_REPO_URL>
cd exploratory-search-viz
```

---

### 3) Backend Setup

Open a terminal and run:

```bash
cd exploratory-search-backend
npm install
```

Create a file named `.env` inside `exploratory-search-backend`:

```env
MONGO_URI=your_mongodb_connection_string
USER_EMAIL=your_email@example.com
PORT=5000
```

Notes:
- `MONGO_URI` is required.
- `USER_EMAIL` is used for polite OpenAlex requests.
- `PORT` can stay `5000`.

Start backend:

```bash
node index.js
```

Expected output includes:
- `Server running on port 5000`
- `Database Connected`

---

### 4) Frontend Setup

Open a second terminal and run:

```bash
cd exploratory-search-frontend
npm install
```

Create `.env` inside `exploratory-search-frontend`:

```env
REACT_APP_API_BASE_URL=http://localhost:5000
```

Start frontend:

```bash
npm start
```

Frontend opens at:
- `http://localhost:3000`

---

## How to Run After Setup

Every time you want to run the project locally:

1. Start backend:
   ```bash
   cd exploratory-search-backend
   node index.js
   ```
2. Start frontend in another terminal:
   ```bash
   cd exploratory-search-frontend
   npm start
   ```

---

## First Use Flow

1. Open `http://localhost:3000`
2. Enter a search term (example: `exploratory search`)
3. Trigger fetch from home page
4. Wait for fetch to complete
5. Open dashboard and explore charts, graph, terms, and papers

---

## Common Issues

### Backend does not start
- Check `.env` exists in `exploratory-search-backend`
- Verify `MONGO_URI` is valid
- Make sure MongoDB allows your IP/network access

### Frontend cannot reach backend (timeouts / 405 / network error)
- Confirm backend terminal is running on port `5000`
- Confirm frontend `.env` has `REACT_APP_API_BASE_URL=http://localhost:5000`
- Restart frontend after editing `.env`

### `npm` command not found
- Node.js is not installed correctly; reinstall from [nodejs.org](https://nodejs.org/)

---

## Project Structure

```text
exploratory-search-viz/
  exploratory-search-backend/
  exploratory-search-frontend/
```
