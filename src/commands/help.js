import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import TimeParser from "../utils/timeParser.js";

export default {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Get help with using the reminder bot"),

    async execute(interaction) {
        // Help command is simple, respond immediately
        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("🤖 Reminder Bot Help")
            .setDescription(
                "I can help you create and manage reminders for yourself and others!",
            )
            .addFields(
                {
                    name: "📝 Commands",
                    value: [
                        "`/remind <time> <message> [user]` - Create a reminder",
                        "`/reminders [action] [id]` - View/manage your reminders",
                        "`/timezone [timezone]` - Set or view your timezone",
                        "`/help` - Show this help message",
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: "⏰ Time Examples",
                    value: TimeParser.getTimeExamples().join("\n"),
                    inline: false,
                },
                {
                    name: "🌍 Timezone Support",
                    value: [
                        "Set your timezone with `/timezone` for better time parsing.",
                        "Supported: UTC, America/New_York, Europe/London, Asia/Tokyo, etc.",
                        "All reminders are processed in UTC but displayed in your timezone.",
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: "👥 Reminding Others",
                    value: [
                        "Use `/remind <time> <message> @user` to remind someone else.",
                        "They'll get notified when the reminder triggers.",
                        "Both you and they can see the reminder in `/reminders`.",
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: "🗂️ Managing Reminders",
                    value: [
                        "`/reminders list` - View active reminders",
                        "`/reminders completed` - View completed reminders",
                        "`/reminders delete <id>` - Delete a specific reminder",
                    ].join("\n"),
                    inline: false,
                },
            )
            .setFooter({ text: "Need more help? Ask a human!" });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
