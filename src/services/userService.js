export class UserService {
    constructor(database) {
        this.db = database;
    }

    async ensureUser(discordId, timezone = "UTC", language = null) {
        let user = this.getUser(discordId);
        if (!user) {
            this.createUser(discordId, timezone, language);
            user = { discord_id: discordId, timezone, language };
        }
        return user;
    }

    async ensureUsers(userIds) {
        const promises = userIds.map((id) => this.ensureUser(id));
        return Promise.all(promises);
    }

    getUserTimezone(discordId) {
        const user = this.getUser(discordId);
        return user?.timezone ?? "UTC";
    }

    getUserLanguage(discordId) {
        const user = this.getUser(discordId);
        return user?.language ?? null;
    }

    async getUserTimezoneAsync(discordId) {
        return this.getUserTimezone(discordId);
    }

    updateUserTimezone(discordId, timezone) {
        const user = this.getUser(discordId);
        if (!user) {
            this.createUser(discordId, timezone);
            return { discord_id: discordId, timezone };
        }

        if (user.timezone !== timezone) {
            this.db.run(`UPDATE users SET timezone = ? WHERE discord_id = ?`, [timezone, discordId]);
        }
        return { discord_id: discordId, timezone };
    }

    updateUserLanguage(discordId, language) {
        const user = this.getUser(discordId);
        if (!user) {
            this.createUser(discordId, "UTC", language);
            return { discord_id: discordId, language };
        }

        if (user.language !== language) {
            this.db.run(`UPDATE users SET language = ? WHERE discord_id = ?`, [language, discordId]);
        }
        return { discord_id: discordId, language };
    }

    getUser(discordId) {
        return this.db.get("SELECT * FROM users WHERE discord_id = ?", [discordId]);
    }

    createUser(discordId, timezone = "UTC", language = null) {
        const result = this.db.run(`INSERT OR REPLACE INTO users (discord_id, timezone, language) VALUES (?, ?, ?)`, [
            discordId,
            timezone,
            language,
        ]);
        return result.lastID;
    }
}
