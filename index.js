const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Carbon backend running" });
});

app.post("/api/test", (req, res) => {
  console.log("Received:", req.body);
  res.status(201).json({ received: req.body });
});

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
