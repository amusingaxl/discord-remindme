export class UserService {
    constructor(database) {
        this.db = database;
    }

    async ensureUser(discordId, timezone = "UTC") {
        let user = this.getUser(discordId);
        if (!user) {
            this.createUser(discordId, timezone);
            user = { discord_id: discordId, timezone };
        }
        return user;
    }

    async ensureUsers(userIds) {
        const promises = userIds.map((id) => this.ensureUser(id));
        return Promise.all(promises);
    }

    getUserTimezone(discordId) {
        const user = this.getUser(discordId);
        return user?.timezone || "UTC";
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
            this.db.run(`UPDATE users SET timezone = ? WHERE discord_id = ?`, [
                timezone,
                discordId,
            ]);
        }
        return { discord_id: discordId, timezone };
    }

    getUser(discordId) {
        return this.db.get("SELECT * FROM users WHERE discord_id = ?", [
            discordId,
        ]);
    }

    createUser(discordId, timezone = "UTC") {
        const result = this.db.run(
            `INSERT OR REPLACE INTO users (discord_id, timezone) VALUES (?, ?)`,
            [discordId, timezone],
        );
        return result.lastID;
    }
}
