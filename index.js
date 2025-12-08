const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Postgres connection pool (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Supabase
});

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
  const { device_id, timestamp_ms, co2_ppm } = req.body;

  // Basic validation
  if (
    typeof device_id !== "string" ||
    typeof timestamp_ms !== "number" ||
    typeof co2_ppm !== "number"
  ) {
    return res.status(400).json({ error: "Invalid payload format" });
  }

  // Update in-memory storage
  lastMeasurement = {
    device_id,
    timestamp_ms,
    co2_ppm,
    received_at: new Date().toISOString()
  };

  console.log("New measurement received:", lastMeasurement);

  // Insert into Supabase DB
  try {
    const query = `
      insert into readings (device_id, timestamp_ms, co2_ppm, received_at)
      values ($1, $2, $3, $4)
      returning id;
    `;
    const params = [
      device_id,
      timestamp_ms,
      co2_ppm,
      new Date()
    ];

    const result = await pool.query(query, params);
    const dbId = result.rows[0].id;

    res.status(201).json({
      status: "ok",
      saved: lastMeasurement,
      db_id: dbId
    });
  } catch (err) {
    console.error("Error inserting into database:", err);
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
