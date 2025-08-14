import { TimeParser } from "./timeParser.js";

class ReminderScheduler {
    constructor(client, reminderService) {
        this.client = client;
        this.reminderService = reminderService;
        this.checkInterval = null;
    }

    start() {
        console.log("🕐 Reminder scheduler started");
        this.checkInterval = setInterval(() => {
            this.checkReminders();
        }, 30000); // Check every 30 seconds

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
            console.log(
                `🔍 Checking reminders... Found ${activeReminders.length} due reminders`,
            );

            if (activeReminders.length > 0) {
                console.log(
                    "Due reminders:",
                    activeReminders.map(
                        (r) => `ID:${r.id} Time:${r.scheduled_time}`,
                    ),
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
            console.log(
                `📨 Processing reminder ${reminder.id}: "${reminder.message}"`,
            );

            const targetUserId = reminder.target_user_id || reminder.user_id;
            const creatorUserId = reminder.user_id;
            const isForSomeoneElse = targetUserId !== creatorUserId;

            // Get the original channel where the reminder was set
            const channel = await this.client.channels.fetch(
                reminder.channel_id,
            );
            if (!channel) {
                console.error(
                    `Channel ${reminder.channel_id} not found for reminder ${reminder.id}`,
                );
                // Keep the reminder in case channel becomes available later
                return;
            }

            // Build simple text message with user mention
            let reminderText;
            if (reminder.message && reminder.message.trim() !== "") {
                reminderText = `🔔 **Reminder** <@${targetUserId}>: ${reminder.message}`;
            } else {
                reminderText = `🔔 **Reminder** <@${targetUserId}>`;
            }

            if (isForSomeoneElse) {
                reminderText += `\n👤 From: <@${creatorUserId}>`;
            }

            let messageOptions = { content: reminderText };

            // If there's a referenced message, create a clickable embed that mimics Discord's reply style
            if (reminder.referenced_message_id && channel.type !== 1) {
                // Show embed in guild channels only
                try {
                    const originalMessage = await channel.messages.fetch(
                        reminder.referenced_message_id,
                    );
                    if (originalMessage) {
                        const { EmbedBuilder } = await import("discord.js");

                        // Create embed that looks like Discord's reply format
                        const messagePreview =
                            originalMessage.content || "*Attachment/Media*";
                        const truncatedPreview =
                            messagePreview.length > 100
                                ? messagePreview.substring(0, 100) + "..."
                                : messagePreview;

                        const replyEmbed = new EmbedBuilder()
                            .setColor("#5865f2") // Discord's blurple color
                            .setAuthor({
                                name:
                                    originalMessage.author.displayName ||
                                    originalMessage.author.username,
                                iconURL:
                                    originalMessage.author.displayAvatarURL(),
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
                        console.log(
                            `✅ Reminder ${reminder.id} sent and deleted for user ${targetUserId}`,
                        );
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
                    const originalMessage = await channel.messages.fetch(
                        reminder.referenced_message_id,
                    );
                    if (originalMessage) {
                        const messagePreview =
                            originalMessage.content || "*Attachment/Media*";
                        const truncatedPreview =
                            messagePreview.length > 150
                                ? messagePreview.substring(0, 150) + "..."
                                : messagePreview;

                        // Create text-based "embed" for DMs
                        reminderText += `\n\n**${originalMessage.author.displayName || originalMessage.author.username}**\n${truncatedPreview}\n[Jump to message →](${reminder.referenced_message_url})`;
                        messageOptions.content = reminderText;

                        console.log(
                            `💬 Sent reminder with text-based embed for message ${reminder.referenced_message_id} in DM for user ${targetUserId}`,
                        );

                        await channel.send(messageOptions);
                        this.reminderService.completeReminder(reminder.id);
                        console.log(
                            `✅ Reminder ${reminder.id} sent and deleted for user ${targetUserId}`,
                        );
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
                `💬 Sending reminder to channel ${channel.name || "DM"} (${channel.id}) for user ${targetUserId}`,
            );
            await channel.send(messageOptions);

            await this.reminderService.completeReminder(reminder.id);
            console.log(
                `✅ Reminder ${reminder.id} sent and deleted for user ${targetUserId}`,
            );
        } catch (error) {
            console.error(`Error processing reminder ${reminder.id}:`, error);

            if (error.code === 10003) {
                console.log(
                    `Channel not found for reminder ${reminder.id}, keeping for retry`,
                );
                // Don't delete - channel might become available
            } else if (error.code === 50013) {
                console.log(
                    `No permissions to send reminder ${reminder.id}, keeping for retry`,
                );
                // Don't delete - permissions might be granted later
            } else if (error.code === 50001) {
                console.log(
                    `Missing access to channel for reminder ${reminder.id}, keeping for retry`,
                );
                // Don't delete - access might be granted later
            }
        }
    }

    async getUpcomingReminders(limit = 10) {
        try {
            const reminders = this.reminderService.getUpcomingReminders(
                null,
                limit,
            );
            return reminders.map((reminder) => ({
                ...reminder,
                formatted_time: TimeParser.formatReminderTime(
                    new Date(reminder.scheduled_time),
                    reminder.timezone || "UTC",
                ),
            }));
        } catch (error) {
            console.error("Error getting upcoming reminders:", error);
            return [];
        }
    }
}

export { ReminderScheduler };
