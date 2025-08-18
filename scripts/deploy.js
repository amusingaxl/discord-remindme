#!/usr/bin/env node
/**
 * Deployment helper script that loads .env file
 * and deploys commands to Discord
 */

import dotenv from "dotenv";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine which env file to use
const envFile = process.argv.includes("--production") ? ".env.production" : ".env.development";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", envFile) });

console.log(`📋 Loaded ${envFile}`);
console.log("🚀 Deploying commands to Discord...\n");

// Deploy commands with inherited environment
const deploy = spawn("node", ["src/deploy-commands.js"], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
});

deploy.on("error", (err) => {
    console.error("Failed to deploy commands:", err);
    process.exit(1);
});

deploy.on("exit", (code) => {
    process.exit(code);
});
