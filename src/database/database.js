import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";

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

        const SQLiteDatabase = sqlite3.verbose().Database;

        this.db = new SQLiteDatabase(dbPath, (err) => {
            if (err) {
                console.error("Error opening database:", err.message);
            } else {
                console.log(`Connected to SQLite database at: ${dbPath}`);
                this.init();
            }
        });
    }

    init() {
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    discord_id TEXT UNIQUE NOT NULL,
                    timezone TEXT DEFAULT 'UTC'
                )
            `);

            this.db.run(`
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
            this.db.run(
                `CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_time)`,
            );
            this.db.run(
                `CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id)`,
            );
            this.db.run(
                `CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id)`,
            );
        });
    }

    async createUser(discordId, timezone = "UTC") {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO users (discord_id, timezone)
                VALUES (?, ?)
            `);

            stmt.run([discordId, timezone], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });

            stmt.finalize();
        });
    }

    async getUser(discordId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT * FROM users WHERE discord_id = ?",
                [discordId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                },
            );
        });
    }

    async updateUserTimezone(discordId, timezone) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE users SET timezone = ? WHERE discord_id = ?
            `);

            stmt.run([timezone, discordId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });

            stmt.finalize();
        });
    }

    async createReminder(
        userId,
        targetUserId,
        guildId,
        channelId,
        message,
        scheduledTime,
        timezone = "UTC",
        referencedMessageId = null,
        referencedMessageUrl = null,
    ) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO reminders (user_id, target_user_id, guild_id, channel_id, message, scheduled_time, timezone, referenced_message_id, referenced_message_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                [
                    userId,
                    targetUserId,
                    guildId,
                    channelId,
                    message,
                    scheduledTime,
                    timezone,
                    referencedMessageId,
                    referencedMessageUrl,
                ],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                },
            );

            stmt.finalize();
        });
    }

    async getActiveReminders() {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            this.db.all(
                "SELECT * FROM reminders WHERE scheduled_time <= ?",
                [now],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                },
            );
        });
    }

    async getUserReminders(discordId) {
        return new Promise((resolve, reject) => {
            const query =
                "SELECT * FROM reminders WHERE (user_id = ? OR target_user_id = ?) ORDER BY scheduled_time ASC";

            this.db.all(query, [discordId, discordId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async completeReminder(reminderId) {
        // Delete the reminder from database after sending notification
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                DELETE FROM reminders WHERE id = ?
            `);

            stmt.run([reminderId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });

            stmt.finalize();
        });
    }

    async deleteReminder(reminderId, userId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                DELETE FROM reminders WHERE id = ? AND user_id = ?
            `);

            stmt.run([reminderId, userId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });

            stmt.finalize();
        });
    }

    close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    console.error("Error closing database:", err.message);
                } else {
                    console.log("Database connection closed");
                }
                resolve();
            });
        });
    }
}
