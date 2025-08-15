import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../constants/config.js";
import { t, getCommandLocalizations } from "../i18n/i18n.js";

export default {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription(t("commands.help.description"))
        .setDescriptionLocalizations(getCommandLocalizations("commands.help.description")),

    async execute(interaction, { timeParser }) {
        // Help command is simple, respond immediately
        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.INFO)
            .setTitle(t("commands.help.title"))
            .setDescription(t("commands.help.intro"))
            .addFields(
                {
                    name: t("commands.help.commandsTitle"),
                    value: [
                        t("commands.help.commands.remind"),
                        t("commands.help.commands.reminders"),
                        t("commands.help.commands.timezone"),
                        t("commands.help.commands.help"),
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: t("commands.help.timeExamplesTitle"),
                    value: timeParser.getTimeExamples().join("\n"),
                    inline: false,
                },
                {
                    name: t("commands.help.timezoneTitle"),
                    value: [
                        t("commands.help.timezoneSupport.line1"),
                        t("commands.help.timezoneSupport.line2"),
                        t("commands.help.timezoneSupport.line3"),
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: t("commands.help.remindingOthersTitle"),
                    value: [
                        t("commands.help.remindingOthers.line1"),
                        t("commands.help.remindingOthers.line2"),
                        t("commands.help.remindingOthers.line3"),
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: t("commands.help.managingRemindersTitle"),
                    value: [
                        t("commands.help.managingReminders.view"),
                        t("commands.help.managingReminders.delete"),
                    ].join("\n"),
                    inline: false,
                },
            )
            .setFooter({ text: t("commands.help.footer") });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
