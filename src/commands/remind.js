import { SlashCommandBuilder } from "discord.js";
import { TimeParser } from "../utils/timeParser.js";

export default {
    data: new SlashCommandBuilder()
        .setName("remind")
        .setDescription("Create a reminder for yourself or someone else")
        .addStringOption((option) =>
            option
                .setName("time")
                .setDescription(
                    'When to remind (e.g., "in 2 hours", "tomorrow at 3pm")',
                )
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription(
                    "What to remind about (can be used with message_link for additional context)",
                )
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("message_link")
                .setDescription(
                    "Discord message link to reference (right-click message → Copy Message Link)",
                )
                .setRequired(false),
        )
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to remind (defaults to yourself)")
                .setRequired(false),
        ),

    async execute(interaction, { userService, reminderService }) {
        const timeString = interaction.options.getString("time");
        const message = interaction.options.getString("message");
        const messageLink = interaction.options.getString("message_link");

        // Require either message or message_link
        if (!message && !messageLink) {
            return await interaction.reply({
                content:
                    '❌ **Please provide either a message or a message link.**\n\n💡 **Options:**\n• Provide `message` for a general reminder\n• Provide `message_link` to reference a specific message (right-click message → Copy Message Link)\n• Use `!remind "time"` when replying to a message for auto-detection',
                ephemeral: true,
            });
        }

        // Parse message ID from Discord URL if provided
        let referencedMessageId = null;
        let referencedMessageUrl = null;
        let originalMessage = null;

        if (messageLink) {
            // Discord message URLs: https://discord.com/channels/guild_id/channel_id/message_id
            // or for DMs: https://discord.com/channels/@me/channel_id/message_id
            const urlMatch = messageLink.match(
                /https:\/\/discord\.com\/channels\/(@me|\d+)\/(\d+)\/(\d+)/,
            );
            if (!urlMatch) {
                return await interaction.reply({
                    content:
                        '❌ Invalid Discord message link. Please copy the link by right-clicking a message and selecting "Copy Message Link".',
                    ephemeral: true,
                });
            }

            const [, , channelId, messageId] = urlMatch;
            referencedMessageId = messageId;
            referencedMessageUrl = messageLink;

            // Try to fetch the original message
            try {
                const targetChannel =
                    await interaction.client.channels.fetch(channelId);
                if (targetChannel) {
                    originalMessage =
                        await targetChannel.messages.fetch(messageId);
                }
            } catch (_error) {
                return await interaction.reply({
                    content:
                        "❌ Could not access the referenced message. Make sure the bot has permission to view that channel and the message exists.",
                    ephemeral: true,
                });
            }
        }
        // Important: If no messageLink is provided, ensure references remain null

        // Try immediate reply to dismiss popover, then quick edit
        await interaction.reply({
            content: "⏳ Processing...",
            ephemeral: true,
        });
        const targetUser =
            interaction.options.getUser("user") || interaction.user;
        const isRemindingOther = targetUser.id !== interaction.user.id;

        // Determine final message
        let finalMessage;
        if (message) {
            // Use provided message text (works with or without message_link)
            finalMessage = message;
        } else if (messageLink && originalMessage) {
            // Leave blank when only using message_link - the embed will show the original message
            finalMessage = "";
        } else {
            // This shouldn't happen due to earlier validation, but just in case
            return await interaction.editReply({
                content:
                    "❌ Please provide either a message or a message link.",
            });
        }

        try {
            // Get user's timezone preference
            const userTimezone = userService.getUserTimezone(
                interaction.user.id,
            );

            // Parse time with user's timezone
            const parsedTime = TimeParser.parseTimeString(
                timeString,
                userTimezone,
            );
            if (!parsedTime || !parsedTime.isValid) {
                return await interaction.editReply({
                    content:
                        '❌ Invalid time format. Try: "in 1 hour", "tomorrow at 3pm", etc.',
                });
            }

            // Create reminder with user's timezone
            await reminderService.createReminder({
                userId: interaction.user.id,
                targetUserId: isRemindingOther ? targetUser.id : null,
                guildId: interaction.guild?.id || null,
                channelId: interaction.channelId,
                message: finalMessage,
                scheduledTime: parsedTime.date.toISOString(),
                timezone: userTimezone,
                referencedMessageId: referencedMessageId,
                referencedMessageUrl: referencedMessageUrl,
            });

            const timeFormatted = TimeParser.formatReminderTime(
                parsedTime.date,
                userTimezone,
            );

            // Simple confirmation message
            const targetText = isRemindingOther
                ? ` for ${targetUser.username}`
                : "";
            await interaction.editReply({
                content: `⏰ Reminder set${targetText} for ${timeFormatted.relative}`,
                allowedMentions: { users: [] }, // Don't ping anyone in confirmation
            });
        } catch (error) {
            console.error("Error creating reminder:", error);

            try {
                await interaction.editReply({
                    content: "❌ Error creating reminder. Please try again.",
                });
            } catch (replyError) {
                console.error("Failed to send error response:", replyError);
            }
        }
    },
};
