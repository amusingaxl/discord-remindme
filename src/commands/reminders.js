import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import database from "../database/database.js";
import TimeParser from "../utils/timeParser.js";

export default {
    data: new SlashCommandBuilder()
        .setName("reminders")
        .setDescription("View and manage your reminders")
        .addStringOption((option) =>
            option
                .setName("action")
                .setDescription("Action to perform")
                .addChoices(
                    { name: "List active reminders", value: "list" },
                    { name: "Delete a reminder", value: "delete" },
                    { name: "View completed reminders", value: "completed" },
                )
                .setRequired(false),
        )
        .addIntegerOption((option) =>
            option
                .setName("id")
                .setDescription("Reminder ID (for delete action)")
                .setRequired(false),
        ),

    async execute(interaction) {
        const action = interaction.options.getString("action") || "list";
        const reminderId = interaction.options.getInteger("id");

        try {
            // Get user record (create if doesn't exist)
            let userRecord = await database.getUser(interaction.user.id);
            if (!userRecord) {
                database.createUser(interaction.user.id).catch(() => {}); // Async, don't wait
                userRecord = {
                    discord_id: interaction.user.id,
                    timezone: "UTC",
                };
            }

            if (action === "delete") {
                if (!reminderId) {
                    const embed = new EmbedBuilder()
                        .setColor("#ff4444")
                        .setTitle("❌ Missing Reminder ID")
                        .setDescription(
                            "Please provide a reminder ID to delete.\nUse `/reminders list` to see your reminder IDs.",
                        );

                    return await interaction.reply({
                        embeds: [embed],
                        ephemeral: true,
                    });
                }

                const deleted = await database.deleteReminder(
                    reminderId,
                    interaction.user.id,
                );

                if (deleted === 0) {
                    const embed = new EmbedBuilder()
                        .setColor("#ff4444")
                        .setTitle("❌ Reminder Not Found")
                        .setDescription(
                            `Reminder with ID ${reminderId} was not found or you don't have permission to delete it.`,
                        );

                    return await interaction.reply({
                        embeds: [embed],
                        ephemeral: true,
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor("#00ff88")
                    .setTitle("✅ Reminder Deleted")
                    .setDescription(`Reminder ${reminderId} has been deleted.`);

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                });
            }

            const includeCompleted = action === "completed";
            const reminders = await database.getUserReminders(
                interaction.user.id,
                includeCompleted,
            );

            if (reminders.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor("#ffaa00")
                    .setTitle("📭 No Reminders")
                    .setDescription(
                        includeCompleted
                            ? "You have no completed reminders."
                            : "You have no active reminders.\n\nUse `/remind` to create a new reminder!",
                    );

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setColor("#0099ff")
                .setTitle(
                    includeCompleted
                        ? "✅ Completed Reminders"
                        : "📋 Your Active Reminders",
                );

            const activeReminders = reminders.filter((r) => !r.is_completed);
            const completedReminders = reminders.filter((r) => r.is_completed);

            if (!includeCompleted && activeReminders.length > 0) {
                const reminderList = activeReminders
                    .slice(0, 10)
                    .map((reminder) => {
                        const timeFormatted = TimeParser.formatReminderTime(
                            new Date(reminder.scheduled_time),
                            userRecord.timezone,
                        );

                        const targetInfo =
                            reminder.target_user_id &&
                            reminder.target_user_id !== reminder.user_id
                                ? ` → <@${reminder.target_user_id}>`
                                : "";

                        return `**${reminder.id}** - ${reminder.message.substring(0, 50)}${reminder.message.length > 50 ? "..." : ""}${targetInfo}\n⏰ ${timeFormatted.relative} (<t:${timeFormatted.timestamp}:R>)`;
                    });

                embed.setDescription(reminderList.join("\n\n"));

                if (activeReminders.length > 10) {
                    embed.setFooter({
                        text: `Showing 10 of ${activeReminders.length} reminders`,
                    });
                }
            } else if (includeCompleted && completedReminders.length > 0) {
                const reminderList = completedReminders
                    .slice(0, 10)
                    .map((reminder) => {
                        const completedTime = new Date(
                            reminder.scheduled_time,
                        ).toLocaleDateString();
                        const targetInfo =
                            reminder.target_user_id &&
                            reminder.target_user_id !== reminder.user_id
                                ? ` → <@${reminder.target_user_id}>`
                                : "";

                        return `**${reminder.id}** - ${reminder.message.substring(0, 50)}${reminder.message.length > 50 ? "..." : ""}${targetInfo}\n✅ Completed on ${completedTime}`;
                    });

                embed.setDescription(reminderList.join("\n\n"));

                if (completedReminders.length > 10) {
                    embed.setFooter({
                        text: `Showing 10 of ${completedReminders.length} completed reminders`,
                    });
                }
            }

            embed.addFields({
                name: "💡 Tip",
                value: "Use `/reminders delete <id>` to delete a reminder",
                inline: false,
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error("Error managing reminders:", error);

            const embed = new EmbedBuilder()
                .setColor("#ff4444")
                .setTitle("❌ Error")
                .setDescription(
                    "Sorry, there was an error managing your reminders. Please try again.",
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
