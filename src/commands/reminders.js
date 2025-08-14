import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { CONFIG } from "../constants/config.js";
import { t, getCommandLocalizations } from "../i18n/i18n.js";

export default {
    data: new SlashCommandBuilder()
        .setName("reminders")
        .setDescription(t("commands.reminders.description"))
        .setDescriptionLocalizations(getCommandLocalizations("commands.reminders.description"))
        .addStringOption((option) =>
            option
                .setName("action")
                .setDescription(t("commands.reminders.options.action"))
                .setDescriptionLocalizations(getCommandLocalizations("commands.reminders.options.action"))
                .addChoices(
                    {
                        name: t("commands.reminders.actions.list"),
                        value: "list",
                    },
                    {
                        name: t("commands.reminders.actions.delete"),
                        value: "delete",
                    },
                )
                .setRequired(false),
        )
        .addIntegerOption((option) =>
            option
                .setName("id")
                .setDescription(t("commands.reminders.options.id"))
                .setDescriptionLocalizations(getCommandLocalizations("commands.reminders.options.id"))
                .setRequired(false),
        ),

    async execute(interaction, { userService, reminderService, timeParser }) {
        const action = interaction.options.getString("action") ?? "list";
        const reminderId = interaction.options.getInteger("id");

        try {
            // Get user record (create if doesn't exist)
            const userRecord = await userService.ensureUser(interaction.user.id);

            if (action === "delete") {
                if (!reminderId) {
                    const embed = new EmbedBuilder()
                        .setColor(CONFIG.COLORS.ERROR)
                        .setTitle(t("errors.missingReminderId"))
                        .setDescription(t("errors.provideReminderId"));

                    return await interaction.reply({
                        embeds: [embed],
                        ephemeral: true,
                    });
                }

                const deleted = await reminderService.deleteReminder(reminderId, interaction.user.id);

                if (deleted === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(CONFIG.COLORS.ERROR)
                        .setTitle(t("errors.reminderNotFound"))
                        .setDescription(t("errors.reminderNotFoundOrNoPermission", { reminderId }));

                    return await interaction.reply({
                        embeds: [embed],
                        ephemeral: true,
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.SUCCESS)
                    .setTitle(t("success.reminderDeletedWithId"))
                    .setDescription(t("success.reminderDeletedMessage", { reminderId }));

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                });
            }

            const reminders = reminderService.getUserReminders(interaction.user.id);

            if (reminders.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.WARNING)
                    .setTitle(t("commands.reminders.noRemindersTitle"))
                    .setDescription(t("commands.reminders.noRemindersMessage"));

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.INFO)
                .setTitle(t("commands.reminders.activeRemindersTitle"));

            if (reminders.length > 0) {
                const reminderList = reminders.slice(0, CONFIG.LIMITS.MAX_REMINDERS_DISPLAY).map((reminder) => {
                    const timeFormatted = timeParser.formatReminderTime(
                        new Date(reminder.scheduled_time),
                        userRecord.timezone,
                    );

                    const targetInfo =
                        reminder.target_user_id && reminder.target_user_id !== reminder.user_id
                            ? ` → <@${reminder.target_user_id}>`
                            : "";

                    return `**${reminder.id}** - ${reminder.message.substring(0, CONFIG.LIMITS.REMINDER_PREVIEW_LENGTH / 2)}${reminder.message.length > CONFIG.LIMITS.REMINDER_PREVIEW_LENGTH / 2 ? "..." : ""}${targetInfo}\n⏰ ${timeFormatted.relative} (<t:${timeFormatted.timestamp}:R>)`;
                });

                embed.setDescription(reminderList.join("\n\n"));

                if (reminders.length > CONFIG.LIMITS.MAX_REMINDERS_DISPLAY) {
                    embed.setFooter({
                        text: t("commands.reminders.showingLimited", {
                            shown: CONFIG.LIMITS.MAX_REMINDERS_DISPLAY,
                            total: reminders.length,
                        }),
                    });
                }
            }

            embed.addFields({
                name: t("commands.reminders.tipTitle"),
                value: t("commands.reminders.tipMessage"),
                inline: false,
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error("Error managing reminders:", error);

            const embed = new EmbedBuilder()
                .setColor("#ff4444")
                .setTitle(t("errors.generalError"))
                .setDescription(
                    t("errors.genericErrorMessage", {
                        action: "managing your reminders",
                    }),
                );

            try {
                if (interaction.replied) {
                    await interaction.followUp({
                        embeds: [embed],
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        embeds: [embed],
                        ephemeral: true,
                    });
                }
            } catch (replyError) {
                console.error("Failed to send error response:", replyError);
            }
        }
    },
};
