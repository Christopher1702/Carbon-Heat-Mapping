/*
  DEMO Carbon backend (Express + Supabase)
  - Matches firmware payload:
    { asset_name, lat, lng, co2_ppm }
  - Simple validation
  - Stores readings in Supabase
*/

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------------------------------------- */
/* Middleware */
app.use(cors());
app.use(express.json());

/* -------------------------------------------------- */
/* Supabase setup */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Supabase env vars are missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/* -------------------------------------------------- */
/* In-memory last reading (demo only) */
let lastMeasurement = null;

/* -------------------------------------------------- */
/* Health check */
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Carbon backend running" });
});

/* -------------------------------------------------- */
/* View last received payload */
app.get("/data", (req, res) => {
  if (!lastMeasurement) {
    return res.status(404).json({ error: "No data received yet" });
  }
  res.json(lastMeasurement);
});

/* -------------------------------------------------- */
/*
  POST /data
  Firmware sends:
    {
      "asset_name": "Simon Fraser University",
      "lat": 49.2781,
      "lng": -122.9199,
      "co2_ppm": 1375
    }
*/
app.post("/data", async (req, res) => {
  const { asset_name, lat, lng, co2_ppm } = req.body;

  // Validation: match firmware schema exactly
  const valid =
    typeof asset_name === "string" &&
    asset_name.trim().length > 0 &&
    typeof lat === "number" &&
    typeof lng === "number" &&
    typeof co2_ppm === "number";

  if (!valid) {
    return res.status(400).json({
      error:
        "Invalid payload. Required: asset_name (string), lat (number), lng (number), co2_ppm (number)"
    });
  }

  // In-memory record for quick /data view
  lastMeasurement = { asset_name, lat, lng, co2_ppm };

  console.log("New measurement received:", lastMeasurement);

  // Insert into Supabase
  try {
    const { error } = await supabase.from("readings").insert({
      asset_name,
      lat,
      lng,
      co2_ppm
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        status: "error",
        message: "Stored in RAM but failed to write to DB",
        supabase_error: error.message
      });
    }

    return res.status(201).json({
      status: "ok",
      saved: lastMeasurement
    });
  } catch (err) {
    console.error("Unexpected error inserting into Supabase:", err);
    return res.status(500).json({
      status: "error",
      message: "Stored in RAM but failed to write to DB"
    });
  }
});

/* -------------------------------------------------- */
/*
  GET /readings
  Returns latest readings (ready for the map).
*/
app.get("/readings", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("readings")
      .select("*")
      .order("id", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Supabase select error:", error);
      return res.status(500).json({ error: "Failed to fetch readings" });
    }

    const out = (data || []).map((row) => ({
      id: row.id,
      asset_name: row.asset_name,
      lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : null,
      lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : null,
      co2_ppm: row.co2_ppm !== null && row.co2_ppm !== undefined ? Number(row.co2_ppm) : null
    }));

    return res.json(out);
  } catch (err) {
    console.error("Unexpected error in /readings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------------------------------------- */
/* Start server */
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
