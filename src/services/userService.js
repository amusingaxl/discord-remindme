import database from "../database/database.js";
import { CONFIG } from "../constants/config.js";

export class UserService {
    static async ensureUser(discordId, timezone = CONFIG.TIMEZONES.DEFAULT) {
        let user = await database.getUser(discordId);
        if (!user) {
            await database.createUser(discordId, timezone);
            user = { discord_id: discordId, timezone };
        }
        return user;
    }

    static async ensureUsers(userIds) {
        const promises = userIds.map((id) => this.ensureUser(id));
        return Promise.all(promises);
    }

    static async getUserTimezone(discordId) {
        const user = await database.getUser(discordId);
        return user?.timezone || CONFIG.TIMEZONES.DEFAULT;
    }
}
