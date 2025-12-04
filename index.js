const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// simple in-memory storage of latest measurement
let lastMeasurement = null;

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Carbon backend running" });
});

// GET endpoint to view the latest data in a browser
app.get("/api/test", (req, res) => {
  if (!lastMeasurement) {
    return res.status(404).json({ error: "No data received yet" });
  }
  res.json(lastMeasurement);
});

// POST endpoint for ESP8266/ESP32 fake (or real) sensor data
app.post("/api/test", (req, res) => {
  const { device_id, timestamp_s, co2_ppm, number } = req.body;

  // basic validation (not strict, just sanity checks)
  if (
    typeof device_id !== "string" ||
    typeof timestamp_s !== "number" ||
    typeof co2_ppm !== "number" ||
    typeof number !== "number"
  ) {
    return res.status(400).json({ error: "Invalid payload format" });
  }

  // construct a normalized measurement object
  lastMeasurement = {
    device_id,
    timestamp_s,
    co2_ppm,
    number,
    received_at: new Date().toISOString(),
  };

  console.log("New measurement received:", lastMeasurement);

  res.status(201).json({ status: "ok", saved: lastMeasurement });
});

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});


