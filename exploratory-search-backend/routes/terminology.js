const express = require("express");
const { getTopTerminologies } = require("../services/terminologyService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const terms = await getTopTerminologies();
    res.json(terms);
  } catch (err) {
    console.error("Terminology route error:", err);
    res.status(500).json({ error: "Failed to load terminology data" });
  }
});

module.exports = router;
