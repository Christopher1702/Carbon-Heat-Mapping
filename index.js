const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Store last received measurement in memory
let lastMeasurement = null;

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Carbon backend running" });
});

// View latest measurement in browser
app.get("/api/test", (req, res) => {
  if (!lastMeasurement) {
    return res.status(404).json({ error: "No data received yet" });
  }
  res.json(lastMeasurement);
});

// ESP8266/ESP32 POST endpoint
app.post("/api/test", (req, res) => {
  const { device_id, timestamp_ms, co2_ppm } = req.body;

  // Basic validation to avoid garbage
  if (
    typeof device_id !== "string" ||
    typeof timestamp_ms !== "number" ||
    typeof co2_ppm !== "number"
  ) {
    return res.status(400).json({ error: "Invalid payload format" });
  }

  // Normalized object we keep on the server
  lastMeasurement = {
    device_id,
    timestamp_ms,
    co2_ppm,
    received_at: new Date().toISOString(),
  };

  console.log("New measurement received:", lastMeasurement);

  res.status(201).json({ status: "ok", saved: lastMeasurement });
});

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
