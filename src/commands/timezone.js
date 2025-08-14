import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { DateTime } from "luxon";
import { CONFIG } from "../constants/config.js";
import { TimeParser } from "../utils/timeParser.js";
import { t, getCommandLocalizations } from "../i18n/i18n.js";

export default {
    data: new SlashCommandBuilder()
        .setName("timezone")
        .setDescription(t("commands.timezone.description"))
        .setDescriptionLocalizations(getCommandLocalizations("commands.timezone.description"))
        .addStringOption((option) =>
            option
                .setName("timezone")
                .setDescription(t("commands.timezone.options.timezone"))
                .setDescriptionLocalizations(getCommandLocalizations("commands.timezone.options.timezone"))
                .setRequired(false)
                .setAutocomplete(true),
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const timezones = TimeParser.getSupportedTimezones();

        const filtered = timezones
            .filter((tz) => tz.toLowerCase().includes(focusedValue))
            .slice(0, CONFIG.TIMEZONES.AUTOCOMPLETE_LIMIT);

        await interaction.respond(filtered.map((tz) => ({ name: tz, value: tz })));
    },

    async execute(interaction, { userService }) {
        const newTimezone = interaction.options.getString("timezone");

        try {
            // For timezone validation, we can respond quickly
            if (newTimezone && !TimeParser.validateTimezone(newTimezone)) {
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.ERROR)
                    .setTitle(t("errors.invalidTimezone"))
                    .setDescription(t("errors.invalidTimezoneValue", { timezone: newTimezone }))
                    .addFields({
                        name: t("commands.timezone.commonTimezonesTitle"),
                        value: TimeParser.getSupportedTimezones().slice(0, 8).join("\n"),
                    })
                    .setFooter({
                        text: t("commands.timezone.useAutocompleteFooter"),
                    });

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                });
            }

            // Get or create user record quickly
            const userRecord = await userService.ensureUser(interaction.user.id, newTimezone ?? "UTC");

            if (!newTimezone) {
                const currentTime = DateTime.now().setZone(userRecord.timezone).toFormat("yyyy-MM-dd HH:mm:ss ZZZZ");

                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.INFO)
                    .setTitle(t("commands.timezone.currentTimezoneTitle"))
                    .addFields(
                        {
                            name: t("commands.timezone.timezoneField"),
                            value: userRecord.timezone,
                            inline: true,
                        },
                        {
                            name: t("commands.timezone.currentTimeField"),
                            value: currentTime,
                            inline: true,
                        },
                    )
                    .setDescription(t("commands.timezone.changeInstruction"))
                    .setFooter({
                        text: t("commands.timezone.commonTimezonesFooter"),
                    });

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                });
            }

            userService.updateUserTimezone(interaction.user.id, newTimezone);

            const newTime = DateTime.now().setZone(newTimezone).toFormat("yyyy-MM-dd HH:mm:ss ZZZZ");

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.SUCCESS)
                .setTitle(t("success.timezoneUpdatedTitle"))
                .addFields(
                    {
                        name: t("commands.timezone.newTimezoneField"),
                        value: newTimezone,
                        inline: true,
                    },
                    {
                        name: t("commands.timezone.currentTimeField"),
                        value: newTime,
                        inline: true,
                    },
                )
                .setDescription(t("commands.timezone.updateDescription"));

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error("Error updating timezone:", error);

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.ERROR)
                .setTitle(t("errors.generalError"))
                .setDescription(
                    t("errors.genericErrorMessage", {
                        action: "updating your timezone",
                    }),
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
