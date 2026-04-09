const express = require("express");
const { getPaperNetwork } = require("../services/paperNetworkService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const parsed = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsed) ? parsed : 0;
    const graph = await getPaperNetwork(limit);
    res.json(graph);
  } catch (err) {
    console.error("Paper network route error:", err);
    res.status(500).json({ error: "Failed to build paper network" });
  }
});

module.exports = router;
