const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Supabase client (HTTP, NOT raw Postgres)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Supabase env vars are missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Store last received measurement in memory
let lastMeasurement = null;

// Root route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Carbon backend running" });
});

// View last measurement
app.get("/api/test", (req, res) => {
  if (!lastMeasurement) {
    return res.status(404).json({ error: "No data received yet" });
  }
  res.json(lastMeasurement);
});

// Receive POSTed sensor data
app.post("/api/test", async (req, res) => {
  const { device_id, co2_ppm } = req.body;

  // Basic validation
  if (
    typeof device_id !== "string" ||
    typeof co2_ppm !== "number"
  ) {
    return res.status(400).json({ error: "Invalid payload format" });
  }

  // Update in-memory storage (backend timestamp only)
  lastMeasurement = {
    device_id,
    co2_ppm,
    received_at: new Date().toISOString()
  };

  console.log("New measurement received:", lastMeasurement);

  // Insert into Supabase via HTTP API
  try {
    const { error } = await supabase
      .from("readings")
      .insert({
        device_id,
        co2_ppm
        // received_at is generated automatically by DB default
      });

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        status: "error",
        message: "Stored in RAM but failed to write to DB"
      });
    }

    res.status(201).json({
      status: "ok",
      saved: lastMeasurement
    });
  } catch (err) {
    console.error("Unexpected error inserting into Supabase:", err);
    res.status(500).json({
      status: "error",
      message: "Stored in RAM but failed to write to DB"
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
