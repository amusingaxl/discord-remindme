import fs from "fs";
import path from "path";
import SQLite from "better-sqlite3";

export class Database {
    constructor(dbPath) {
        if (!dbPath) {
            throw new Error("Database path is required");
        }

        // Ensure the directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log(`Created database directory: ${dbDir}`);
        }

        // Open database connection
        this.db = new SQLite(dbPath);
        console.log(`Connected to SQLite database at: ${dbPath}`);

        // Enable foreign keys
        this.db.pragma("foreign_keys = ON");

        // Enable write-ahead logging
        this.db.pragma("journal_mode = WAL");

        // Initialize tables
        this.init();
    }

    init() {
        // Create users table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                discord_id TEXT PRIMARY KEY,
                timezone TEXT DEFAULT 'UTC',
                language TEXT DEFAULT NULL
            )
        `);

        // Create reminders table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                target_user_id TEXT,
                guild_id TEXT,
                channel_id TEXT NOT NULL,
                message TEXT NOT NULL,
                scheduled_time DATETIME NOT NULL,
                timezone TEXT DEFAULT 'UTC',
                referenced_message_id TEXT,
                referenced_message_url TEXT,
                FOREIGN KEY (user_id) REFERENCES users (discord_id)
            )
        `);

        // Create indexes for better performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_time);
            CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
        `);

        // Add language column to existing users table if it doesn't exist
        try {
            const columns = this.db.pragma("table_info(users)");
            const hasLanguage = columns.some((col) => col.name === "language");
            if (!hasLanguage) {
                this.db.exec(`ALTER TABLE users ADD COLUMN language TEXT DEFAULT NULL`);
                console.log("Added language column to users table");
            }
        } catch {
            // Column might already exist, ignore error
        }
    }

    // Get a single row
    get(query, params = []) {
        const stmt = this.db.prepare(query);
        return stmt.get(...params);
    }

    // Get all rows
    all(query, params = []) {
        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    // Run a query (insert, update, delete)
    run(query, params = []) {
        const stmt = this.db.prepare(query);
        const result = stmt.run(...params);
        return {
            lastID: result.lastInsertRowid,
            changes: result.changes,
        };
    }

    // Prepare a statement for reuse
    prepare(query) {
        return this.db.prepare(query);
    }

    // Execute multiple statements in a transaction
    transaction(fn) {
        return this.db.transaction(fn);
    }

    // Close the database connection
    close() {
        try {
            this.db.close();
            console.log("Database connection closed");
        } catch (err) {
            console.error("Error closing database:", err.message);
        }
    }
}
