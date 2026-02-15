# Exploratory Search Visualization

This project consists of a **Node.js/Express** backend and a **React** frontend. Follow these steps to get the environment running locally.

---

## 🚀 Getting Started

### 1. Clone the Repository
Open your terminal and run:
```bash
git clone [https://github.com/Akane-Asahi/exploratory-search-viz.git](https://github.com/Akane-Asahi/exploratory-search-viz.git)
cd exploratory-search-viz
```

### 2. Setup the Backend
Collect `.env` file from the author.

Open a terminal window:
```bash
cd exploratory-search-backend
npm install
node index.js
```
The API should now be active.

### 3. Setup the Frontend
Open a new, separate terminal window:
```bash
cd exploratory-search-frontend
npm install
npm start
```
The browser should open automatically to http://localhost:3000.

## 🌿 Collaboration Workflow

To keep the `main` branch stable, please work on a dedicated branch for your view:

1. **Create your branch:** `git checkout -b feature/your-view-name`

2. **Save your work:** `git add .`, and then 
`git commit -m "added new view component"`

3. **Push to GitHub:** `git push origin feature/your-view-name`

## ⚠️ Notes

Do not delete the `.gitignore` files.

Ensure you have **Node.js** installed before running `npm install`.