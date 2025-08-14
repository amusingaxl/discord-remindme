import { SlashCommandBuilder } from "discord.js";
import { t, getCommandLocalizations } from "../i18n/i18n.js";

export default {
    data: new SlashCommandBuilder()
        .setName("remind")
        .setDescription(t("commands.remind.description"))
        .setDescriptionLocalizations(getCommandLocalizations("commands.remind.description"))
        .addStringOption((option) =>
            option
                .setName("time")
                .setDescription(t("commands.remind.options.time"))
                .setDescriptionLocalizations(getCommandLocalizations("commands.remind.options.time"))
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription(t("commands.remind.options.message"))
                .setDescriptionLocalizations(getCommandLocalizations("commands.remind.options.message"))
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("message_link")
                .setDescription(t("commands.remind.options.messageLink"))
                .setDescriptionLocalizations(getCommandLocalizations("commands.remind.options.messageLink"))
                .setRequired(false),
        )
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription(t("commands.remind.options.user"))
                .setDescriptionLocalizations(getCommandLocalizations("commands.remind.options.user"))
                .setRequired(false),
        ),

    async execute(interaction, { userService, reminderService, timeParser }) {
        const timeString = interaction.options.getString("time");
        const message = interaction.options.getString("message");
        const messageLink = interaction.options.getString("message_link");

        // Require either message or message_link
        if (!message && !messageLink) {
            return await interaction.reply({
                content: t("errors.provideMessageOrLinkDetailed"),
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
            const urlMatch = messageLink.match(/https:\/\/discord\.com\/channels\/(@me|\d+)\/(\d+)\/(\d+)/);
            if (!urlMatch) {
                return await interaction.reply({
                    content: t("errors.invalidMessageLink"),
                    ephemeral: true,
                });
            }

            const [, , channelId, messageId] = urlMatch;
            referencedMessageId = messageId;
            referencedMessageUrl = messageLink;

            // Try to fetch the original message
            try {
                const targetChannel = await interaction.client.channels.fetch(channelId);
                if (targetChannel) {
                    originalMessage = await targetChannel.messages.fetch(messageId);
                }
            } catch {
                return await interaction.reply({
                    content: t("errors.messageNotFound"),
                    ephemeral: true,
                });
            }
        }
        // Important: If no messageLink is provided, ensure references remain null

        // Try immediate reply to dismiss popover, then quick edit
        await interaction.reply({
            content: t("success.processing"),
            ephemeral: true,
        });
        const targetUser = interaction.options.getUser("user") ?? interaction.user;
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
                content: t("errors.provideMessageOrLink"),
            });
        }

        try {
            // Get user's timezone preference
            const userTimezone = userService.getUserTimezone(interaction.user.id);

            // Parse time with user's timezone
            const parsedTime = timeParser.parseTimeString(timeString, userTimezone);
            if (!parsedTime?.isValid) {
                return await interaction.editReply({
                    content: t("errors.invalidTime"),
                });
            }

            // Create reminder with user's timezone
            await reminderService.createReminder({
                userId: interaction.user.id,
                targetUserId: isRemindingOther ? targetUser.id : null,
                guildId: interaction.guild?.id ?? null,
                channelId: interaction.channelId,
                message: finalMessage,
                scheduledTime: parsedTime.date.toISOString(),
                timezone: userTimezone,
                referencedMessageId: referencedMessageId,
                referencedMessageUrl: referencedMessageUrl,
            });

            const timeFormatted = timeParser.formatReminderTime(parsedTime.date, userTimezone);

            // Simple confirmation message
            const targetText = isRemindingOther ? ` for ${targetUser.username}` : "";
            await interaction.editReply({
                content: t("success.reminderSetFor", {
                    targetText: targetText,
                    time: timeFormatted.relative,
                }),
                allowedMentions: { users: [] }, // Don't ping anyone in confirmation
            });
        } catch (error) {
            console.error("Error creating reminder:", error);

            try {
                await interaction.editReply({
                    content: t("errors.reminderCreationFailed"),
                });
            } catch (replyError) {
                console.error("Failed to send error response:", replyError);
            }
        }
    },
};
