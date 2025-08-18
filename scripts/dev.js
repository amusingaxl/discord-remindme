#!/usr/bin/env node
/**
 * Development helper script that loads .env.development file
 * and starts the bot for local development without Docker
 */

import dotenv from "dotenv";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load development environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.development") });

console.log("📋 Loaded .env.development");
console.log("🚀 Starting bot in development mode...\n");

// Start the bot with inherited environment
const bot = spawn("node", ["src/bot.js"], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
});

bot.on("error", (err) => {
    console.error("Failed to start bot:", err);
    process.exit(1);
});

bot.on("exit", (code) => {
    process.exit(code);
});
