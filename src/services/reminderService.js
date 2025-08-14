import { CONFIG } from "../constants/config.js";

export class ReminderService {
    constructor(database, userService) {
        this.db = database;
        this.userService = userService;
    }

    async createReminder({
        userId,
        targetUserId = null,
        guildId = null,
        channelId,
        message,
        scheduledTime,
        timezone = "UTC",
        referencedMessageId = null,
        referencedMessageUrl = null,
    }) {
        // Ensure users exist
        await this.userService.ensureUser(userId, timezone);
        if (targetUserId && targetUserId !== userId) {
            await this.userService.ensureUser(targetUserId);
        }

        const result = this.db.run(
            `INSERT INTO reminders (
                user_id, target_user_id, guild_id, channel_id,
                message, scheduled_time, timezone,
                referenced_message_id, referenced_message_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        );
        return result.lastID;
    }

    getUserReminders(discordId) {
        const query = `
            SELECT * FROM reminders
            WHERE (user_id = ? OR target_user_id = ?)
            ORDER BY scheduled_time ASC
        `;
        return this.db.all(query, [discordId, discordId]);
    }

    async getUserRemindersAsync(discordId) {
        return this.getUserReminders(discordId);
    }

    getActiveReminders() {
        const now = new Date().toISOString();
        return this.db.all("SELECT * FROM reminders WHERE scheduled_time <= ?", [now]);
    }

    async getActiveRemindersAsync() {
        return this.getActiveReminders();
    }

    completeReminder(reminderId) {
        const result = this.db.run("DELETE FROM reminders WHERE id = ?", [reminderId]);
        return result.changes;
    }

    async completeReminderAsync(reminderId) {
        return this.completeReminder(reminderId);
    }

    deleteReminder(reminderId, userId) {
        const result = this.db.run("DELETE FROM reminders WHERE id = ? AND user_id = ?", [reminderId, userId]);
        return result.changes;
    }

    async deleteReminderAsync(reminderId, userId) {
        return this.deleteReminder(reminderId, userId);
    }

    getReminderById(reminderId) {
        return this.db.get("SELECT * FROM reminders WHERE id = ?", [reminderId]);
    }

    countUserReminders(discordId) {
        const reminders = this.getUserReminders(discordId);
        return reminders.length;
    }

    getUpcomingReminders(discordId, limit = CONFIG.LIMITS.MAX_REMINDERS_DISPLAY) {
        if (discordId) {
            const query = `
                SELECT * FROM reminders
                WHERE (user_id = ? OR target_user_id = ?)
                AND scheduled_time > datetime('now')
                ORDER BY scheduled_time ASC
                LIMIT ?
            `;
            return this.db.all(query, [discordId, discordId, limit]);
        } else {
            const query = `
                SELECT * FROM reminders
                WHERE scheduled_time > datetime('now')
                ORDER BY scheduled_time ASC
                LIMIT ?
            `;
            return this.db.all(query, [limit]);
        }
    }

    async getUpcomingRemindersAsync(discordId, limit = CONFIG.LIMITS.MAX_REMINDERS_DISPLAY) {
        return this.getUpcomingReminders(discordId, limit);
    }
}
