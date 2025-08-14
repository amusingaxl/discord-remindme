import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { CONFIG } from "../constants/config.js";
import { t, getLocale, withLocale, getCommandLocalizations } from "../i18n/i18n.js";

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

        try {
            // Get the user's current language for this response
            const currentLang = getLocale(interaction, userService);

            if (!newLanguage) {
                // Show current language setting
                const userRecord = await userService.ensureUser(userId);
                const currentSetting = userRecord.language ?? "auto";
                const displayLanguage =
                    currentSetting === "auto"
                        ? `Auto-detect (currently: ${currentLang})`
                        : getLanguageName(currentSetting);

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

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Validate language
            const validLanguages = ["en-US", "es-ES", "auto"];
            if (!validLanguages.includes(newLanguage)) {
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.ERROR)
                    .setTitle(t("errors.invalidLanguage"))
                    .setDescription(t("errors.invalidLanguageValue", { language: newLanguage }))
                    .addFields({
                        name: t("commands.language.availableLanguagesTitle"),
                        value: "English (en), Español (es)",
                    });

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                });
            }

            // Update language preference in database FIRST
            const localeToStore = newLanguage === "auto" ? null : newLanguage;
            userService.updateUserLanguage(userId, localeToStore);

            // THEN determine the effective language for the response
            let effectiveLocale;
            if (newLanguage === "auto") {
                // For auto, show message in Discord's detected locale
                // This will now correctly use Discord's locale since DB is already updated
                effectiveLocale = getLocale(interaction, userService);
            } else {
                effectiveLocale = newLanguage;
            }

            const displayLanguage =
                newLanguage === "auto" ? `Auto-detect (currently: ${effectiveLocale})` : getLanguageName(newLanguage);

            // Show success message in the NEW locale
            await withLocale(effectiveLocale, async () => {
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.SUCCESS)
                    .setTitle(t("success.languageUpdatedTitle"))
                    .addFields({
                        name: t("commands.language.newLanguageField"),
                        value: displayLanguage,
                        inline: true,
                    })
                    .setDescription(t("commands.language.updateDescription"));

                await interaction.reply({ embeds: [embed], ephemeral: true });
            });
        } catch (error) {
            console.error("Error updating language:", error);

            // Fallback to English for error message
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.ERROR)
                .setTitle("❌ Error")
                .setDescription("Sorry, there was an error updating your language preference. Please try again.");

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};

function getLanguageName(code) {
    const names = {
        "en-US": "English",
        "es-ES": "Español (Spanish)",
    };
    return names[code] ?? code;
}
