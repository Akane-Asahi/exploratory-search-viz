const express = require("express");
const { getPaperNetwork } = require("../services/paperNetworkService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const graph = await getPaperNetwork(limit);
    res.json(graph);
  } catch (err) {
    console.error("Paper network route error:", err);
    res.status(500).json({ error: "Failed to build paper network" });
  }
});

module.exports = router;
