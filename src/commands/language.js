import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../constants/config.js";
import { t, getCommandLocalizations } from "../i18n/i18n.js";
import { getUserPreferences, withPreferences } from "../context/userPreferences.js";

export default {
    data: new SlashCommandBuilder()
        .setName("language")
        .setDescription(t("commands.language.description"))
        .setDescriptionLocalizations(getCommandLocalizations("commands.language.description"))
        .addStringOption((option) =>
            option
                .setName("language")
                .setDescription(t("commands.language.options.language"))
                .setDescriptionLocalizations(getCommandLocalizations("commands.language.options.language"))
                .setRequired(false)
                .addChoices(
                    { name: "English (US)", value: "en-US" },
                    { name: "Español (España)", value: "es-ES" },
                    { name: "Auto-detect from Discord", value: "auto" },
                ),
        ),

    async execute(interaction, { userService }) {
        const newLanguage = interaction.options.getString("language");
        const userId = interaction.user.id;

        // Defer immediately to avoid timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Get the user's current language for this response
            const preferences = getUserPreferences(interaction, userService);
            const currentLanguage = preferences.locale;

            if (!newLanguage) {
                // Show current language setting
                const userRecord = await userService.ensureUser(userId);
                const currentSetting = userRecord.language ?? "auto";
                const displayLanguage =
                    currentSetting === "auto"
                        ? t("commands.language.autoDetectDisplay", {
                              locale: t(`commands.language.languages.${currentLanguage}`),
                          })
                        : t(`commands.language.languages.${currentSetting}`);

                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.INFO)
                    .setTitle(t("commands.language.currentLanguageTitle"))
                    .addFields({
                        name: t("commands.language.languageField"),
                        value: displayLanguage,
                        inline: true,
                    })
                    .setDescription(t("commands.language.changeInstruction"))
                    .setFooter({
                        text: t("commands.language.availableLanguagesFooter"),
                    });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Validate language
            const validLanguages = ["en-US", "es-ES", "auto"];
            if (!validLanguages.includes(newLanguage)) {
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.ERROR)
                    .setTitle(t("errors.invalidLanguage"))
                    .setDescription(
                        t("errors.invalidLanguageValue", {
                            locale: t(`commands.language.languages.${newLanguage}`),
                        }),
                    )
                    .addFields({
                        name: t("commands.language.availableLanguagesTitle"),
                        value: t("commands.language.availableLanguagesList"),
                    });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Update language preference in database FIRST
            const localeToStore = newLanguage === "auto" ? null : newLanguage;
            userService.updateUserLanguage(userId, localeToStore);

            // THEN determine the effective language for the response
            let effectiveLocale;
            if (newLanguage === "auto") {
                // For auto, show message in Discord's detected locale
                // This will now correctly use Discord's locale since DB is already updated
                const prefs = getUserPreferences(interaction, userService);
                effectiveLocale = prefs.locale;
            } else {
                effectiveLocale = newLanguage;
            }

            // Show success message in the NEW locale
            await withPreferences({ locale: effectiveLocale }, async () => {
                // Generate display language INSIDE the new locale context
                const displayLanguage =
                    newLanguage === "auto"
                        ? t("commands.language.autoDetectDisplay", {
                              locale: t(`commands.language.languages.${effectiveLocale}`),
                          })
                        : t(`commands.language.languages.${newLanguage}`);

                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.SUCCESS)
                    .setTitle(t("success.languageUpdatedTitle"))
                    .addFields({
                        name: t("commands.language.newLanguageField"),
                        value: displayLanguage,
                        inline: true,
                    })
                    .setDescription(t("commands.language.updateDescription"));

                await interaction.editReply({ embeds: [embed] });
            });
        } catch (error) {
            console.error("Error updating language:", error);

            // Show error message
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.ERROR)
                .setTitle(t("success.languageUpdateError"))
                .setDescription(t("success.languageUpdateErrorMessage"));

            // Use followUp if we've already replied, otherwise reply
            try {
                if (interaction.replied) {
                    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.editReply({ embeds: [embed] });
                }
            } catch (replyError) {
                console.error("Failed to send error response:", replyError);
            }
        }
    },
};
