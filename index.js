/*
  DEMO Carbon backend (Express + Supabase)
  - Matches firmware payload:
    { device_id, co2_ppm, asset_type, asset_name, co2_emission_kg_per_hr }
  - Removes old Vancouver street coordinate mapping (deviceCoords)
  - Keeps simple demo-grade logic
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
      "device_id": "university_0",
      "co2_ppm": 1200,
      "asset_type": "university",
      "asset_name": "Simon Fraser University",
      "co2_emission_kg_per_hr": 295.4
    }
*/
app.post("/data", async (req, res) => {
  const {
    device_id,
    co2_ppm,
    asset_type,
    asset_name,
    co2_emission_kg_per_hr
  } = req.body;

  // Validation: match firmware schema exactly
  const valid =
    typeof device_id === "string" &&
    device_id.trim().length > 0 &&
    typeof co2_ppm === "number" &&
    typeof asset_type === "string" &&
    asset_type.trim().length > 0 &&
    typeof asset_name === "string" &&
    asset_name.trim().length > 0 &&
    typeof co2_emission_kg_per_hr === "number";

  if (!valid) {
    return res.status(400).json({
      error:
        "Invalid payload. Required: device_id (string), co2_ppm (number), asset_type (string), asset_name (string), co2_emission_kg_per_hr (number)"
    });
  }

  // In-memory record for quick /data view
  lastMeasurement = {
    device_id,
    co2_ppm,
    asset_type,
    asset_name,
    co2_emission_kg_per_hr
  };

  console.log("New measurement received:", lastMeasurement);

  // Insert into Supabase
  try {
    const { error } = await supabase.from("readings").insert({
      device_id,
      co2_ppm,
      asset_type,
      asset_name,
      co2_emission_kg_per_hr
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
  Returns latest readings (no coords, no dropping).
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

    // Ensure numeric parsing
    const out = (data || []).map((row) => ({
      id: row.id,
      device_id: row.device_id,
      co2_ppm: row.co2_ppm !== null && row.co2_ppm !== undefined ? Number(row.co2_ppm) : null,
      asset_type: row.asset_type,
      asset_name: row.asset_name,
      co2_emission_kg_per_hr:
        row.co2_emission_kg_per_hr !== null && row.co2_emission_kg_per_hr !== undefined
          ? Number(row.co2_emission_kg_per_hr)
          : null
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
