import { CONFIG, DISCORD_ERRORS } from "../constants/config.js";
import { TimeParser } from "./timeParser.js";
import { t } from "../i18n/i18n.js";
import { withPreferences } from "../context/userPreferences.js";

class ReminderScheduler {
    constructor(client, reminderService, userService) {
        this.client = client;
        this.reminderService = reminderService;
        this.userService = userService;
        this.checkInterval = null;
    }

    start() {
        console.log("🕐 Reminder scheduler started");
        this.checkInterval = setInterval(() => {
            this.checkReminders();
        }, CONFIG.SCHEDULER.CHECK_INTERVAL);

        this.checkReminders();
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log("⏹️ Reminder scheduler stopped");
        }
    }

    async checkReminders() {
        try {
            const activeReminders = this.reminderService.getActiveReminders();
            console.log(`🔍 Checking reminders... Found ${activeReminders.length} due reminders`);

            if (activeReminders.length > 0) {
                console.log(
                    "Due reminders:",
                    activeReminders.map((r) => `ID:${r.id} Time:${r.scheduled_time}`),
                );
            }

            for (const reminder of activeReminders) {
                await this.processReminder(reminder);
            }
        } catch (error) {
            console.error("Error checking reminders:", error);
        }
    }

    async processReminder(reminder) {
        try {
            console.log(`📨 Processing reminder ${reminder.id}: "${reminder.message}"`);

            const targetUserId = reminder.target_user_id ?? reminder.user_id;
            const creatorUserId = reminder.user_id;
            const isForSomeoneElse = targetUserId !== creatorUserId;

            // Get the original channel where the reminder was set
            const channel = await this.client.channels.fetch(reminder.channel_id);
            if (!channel) {
                console.error(`Channel ${reminder.channel_id} not found for reminder ${reminder.id}`);
                // Keep the reminder in case channel becomes available later
                return;
            }

            // Get the target user's preferences (language and timezone)
            const targetUserLanguage = this.userService.getUserLanguage(targetUserId);
            const targetUserTimezone = this.userService.getUserTimezone(targetUserId);
            const preferences = {
                locale: targetUserLanguage ?? "en-US",
                timezone: targetUserTimezone ?? "UTC",
            };

            // Build simple text message with user mention - use target user's preferences
            let reminderText;
            await withPreferences(preferences, async () => {
                if (reminder.message && reminder.message.trim() !== "") {
                    reminderText = t("reminder.notification", {
                        userId: targetUserId,
                        message: reminder.message,
                    });
                } else {
                    reminderText = t("reminder.notificationNoMessage", { userId: targetUserId });
                }

                if (isForSomeoneElse) {
                    reminderText += `\n${t("reminder.fromUser", { userId: creatorUserId })}`;
                }
            });

            let messageOptions = { content: reminderText };

            // If there's a referenced message, create a clickable embed that mimics Discord's reply style
            if (reminder.referenced_message_id && channel.type !== 1) {
                // Show embed in guild channels only
                try {
                    const originalMessage = await channel.messages.fetch(reminder.referenced_message_id);
                    if (originalMessage) {
                        const { EmbedBuilder } = await import("discord.js");

                        // Create embed that looks like Discord's reply format
                        const messagePreview = originalMessage.content ?? "*Attachment/Media*";
                        const truncatedPreview =
                            messagePreview.length > CONFIG.LIMITS.REMINDER_PREVIEW_LENGTH
                                ? messagePreview.substring(0, CONFIG.LIMITS.REMINDER_PREVIEW_LENGTH) + "..."
                                : messagePreview;

                        const replyEmbed = new EmbedBuilder()
                            .setColor(CONFIG.COLORS.DISCORD)
                            .setAuthor({
                                name: originalMessage.author.displayName ?? originalMessage.author.username,
                                iconURL: originalMessage.author.displayAvatarURL(),
                            })
                            .setDescription(
                                `${truncatedPreview}\n\n[Jump to message →](${reminder.referenced_message_url})`,
                            );

                        await channel.send({
                            content: reminderText,
                            embeds: [replyEmbed],
                        });

                        console.log(
                            `💬 Sent reminder with clickable embed for message ${reminder.referenced_message_id} in channel ${channel.name} for user ${targetUserId}`,
                        );

                        this.reminderService.completeReminder(reminder.id);
                        console.log(`✅ Reminder ${reminder.id} sent and deleted for user ${targetUserId}`);
                        return; // Exit early since we sent the message
                    }
                } catch (error) {
                    console.log(
                        `❌ Could not create clickable embed for original message ${reminder.referenced_message_id}: ${error.message}`,
                    );
                    // Fall through to regular message sending with link
                }
            }

            // For DMs with referenced messages, create a text-based embed mimic
            if (reminder.referenced_message_id && channel.type === 1) {
                // DM channel
                try {
                    const originalMessage = await channel.messages.fetch(reminder.referenced_message_id);
                    if (originalMessage) {
                        const messagePreview = originalMessage.content ?? "*Attachment/Media*";
                        const truncatedPreview =
                            messagePreview.length > CONFIG.LIMITS.DM_PREVIEW_LENGTH
                                ? messagePreview.substring(0, CONFIG.LIMITS.DM_PREVIEW_LENGTH) + "..."
                                : messagePreview;

                        // Create text-based "embed" for DMs
                        reminderText += `\n\n**${originalMessage.author.displayName ?? originalMessage.author.username}**\n${truncatedPreview}\n[Jump to message →](${reminder.referenced_message_url})`;
                        messageOptions.content = reminderText;

                        console.log(
                            `💬 Sent reminder with text-based embed for message ${reminder.referenced_message_id} in DM for user ${targetUserId}`,
                        );

                        await channel.send(messageOptions);
                        this.reminderService.completeReminder(reminder.id);
                        console.log(`✅ Reminder ${reminder.id} sent and deleted for user ${targetUserId}`);
                        return; // Exit early since we sent the message
                    }
                } catch (error) {
                    console.log(
                        `❌ Could not create text-based embed for original message ${reminder.referenced_message_id}: ${error.message}`,
                    );
                    // Fall through to regular message sending with link
                }
            }

            // Fallback: send regular message with link
            if (reminder.referenced_message_url) {
                reminderText += `\n[Jump to message →](${reminder.referenced_message_url})`;
                messageOptions.content = reminderText;
            }

            console.log(
                `💬 Sending reminder to channel ${channel.name ?? "DM"} (${channel.id}) for user ${targetUserId}`,
            );
            await channel.send(messageOptions);

            await this.reminderService.completeReminder(reminder.id);
            console.log(`✅ Reminder ${reminder.id} sent and deleted for user ${targetUserId}`);
        } catch (error) {
            console.error(`Error processing reminder ${reminder.id}:`, error);

            if (error.code === DISCORD_ERRORS.UNKNOWN_CHANNEL) {
                console.log(`Channel not found for reminder ${reminder.id}, keeping for retry`);
                // Don't delete - channel might become available
            } else if (error.code === DISCORD_ERRORS.MISSING_PERMISSIONS) {
                console.log(`No permissions to send reminder ${reminder.id}, keeping for retry`);
                // Don't delete - permissions might be granted later
            } else if (error.code === DISCORD_ERRORS.MISSING_ACCESS) {
                console.log(`Missing access to channel for reminder ${reminder.id}, keeping for retry`);
                // Don't delete - access might be granted later
            }
        }
    }

    async getUpcomingReminders(limit = CONFIG.LIMITS.MAX_REMINDERS_DISPLAY) {
        try {
            const reminders = this.reminderService.getUpcomingReminders(null, limit);
            return reminders.map((reminder) => ({
                ...reminder,
                formatted_time: TimeParser.formatReminderTime(
                    new Date(reminder.scheduled_time),
                    reminder.timezone ?? "UTC",
                ),
            }));
        } catch (error) {
            console.error("Error getting upcoming reminders:", error);
            return [];
        }
    }
}

export { ReminderScheduler };
