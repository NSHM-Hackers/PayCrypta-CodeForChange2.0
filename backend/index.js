import express from "express";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

import cors from "cors";
import apiRoutes from "./routes/index.js";
import { connectDB } from "./utils/db.js";

// The __dirname variable does not work in ES modules, so we need to create it manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an expressjs server
const app = express();
// Connect to the database
connectDB();

// Add middleware to parse JSON and handle CORS
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// API routes first
app.use("/api", apiRoutes);

// Serve static assets from the Vite build
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Fallback to index.html for SPA routing
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Example expressjs server listening on port 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
