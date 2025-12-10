const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Supabase client (HTTP API)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Supabase env vars are missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Store last measurement in memory
let lastMeasurement = null;

// Approximate coordinates for each device_id (street)
const deviceCoords = {
  "Granville St": { lat: 49.2827, lng: -123.1187 },
  "Main St": { lat: 49.2734, lng: -123.1000 },
  "Broadway": { lat: 49.2625, lng: -123.1140 },
  "Kingsway": { lat: 49.2485, lng: -123.0650 },
  "Fraser St": { lat: 49.2570, lng: -123.0900 },
  "Commercial Dr": { lat: 49.2730, lng: -123.0690 },
  "Hastings St": { lat: 49.2810, lng: -123.0560 },
  "Robson St": { lat: 49.2835, lng: -123.1210 },
  "Davie St": { lat: 49.2810, lng: -123.1330 },
  "Denman St": { lat: 49.2900, lng: -123.1390 },
  "West 4th Ave": { lat: 49.2680, lng: -123.1550 },
  "West 41st Ave": { lat: 49.2330, lng: -123.1160 },
  "Knight St": { lat: 49.2430, lng: -123.0770 },
  "Cambie St": { lat: 49.2660, lng: -123.1150 },
  "Victoria Dr": { lat: 49.2490, lng: -123.0650 }
};

// Root route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Carbon backend running" });
});

// View last measurement (optional)
app.get("/data", (req, res) => {
  if (!lastMeasurement) {
    return res.status(404).json({ error: "No data received yet" });
  }
  res.json(lastMeasurement);
});

// Receive POSTed sensor data
app.post("/data", async (req, res) => {
  const { device_id, co2_ppm } = req.body;

  // Basic validation
  if (typeof device_id !== "string" || typeof co2_ppm !== "number") {
    return res.status(400).json({ error: "Invalid payload format" });
  }

  // Update in-memory storage
  lastMeasurement = {
    device_id,
    co2_ppm,
    received_at: new Date().toISOString()
  };

  console.log("New measurement received:", lastMeasurement);

  // Insert into Supabase
  try {
    const { error } = await supabase.from("readings").insert({
      device_id,
      co2_ppm
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

// Return latest readings with coordinates for the frontend
app.get("/readings", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("readings")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Supabase select error:", error);
      return res.status(500).json({ error: "Failed to fetch readings" });
    }

    const enriched = data
      .map((row) => {
        const coords = deviceCoords[row.device_id];
        if (!coords) return null;

        return {
          id: row.id,
          device_id: row.device_id,
          co2_ppm: Number(row.co2_ppm),
          received_at: row.received_at,
          lat: coords.lat,
          lng: coords.lng
        };
      })
      .filter(Boolean);

    res.json(enriched);
  } catch (err) {
    console.error("Unexpected error in /readings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
