import { use, t as _t } from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";
import { fileURLToPath } from "url";
import { getCurrentPreferences } from "../context/userPreferences.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize i18next
await use(Backend).init({
    lng: "en-US",
    fallbackLng: "en-US",
    supportedLngs: ["en-US", "es-ES"],
    ns: ["translation"],
    defaultNS: "translation",
    backend: {
        loadPath: path.join(__dirname, "locales", "{{lng}}", "{{ns}}.json"),
    },
    interpolation: {
        escapeValue: false,
    },
    returnEmptyString: false,
    returnNull: false,
    preload: ["en-US", "es-ES"], // Preload both locales
});

/**
 * Translation function that uses user preferences context for language
 * @param {string} key - Translation key
 * @param {object} options - Translation options/variables
 * @returns {string} Translated string
 */
export function t(key, options = {}) {
    const preferences = getCurrentPreferences();
    return _t(key, { ...options, lng: preferences.locale });
}

/**
 * Get translations for Discord command localizations
 * @param {string} key - Translation key
 * @returns {object} Object with Discord locale codes as keys
 */
export function getCommandLocalizations(key) {
    const localizations = {};

    // Map our locales to Discord locale codes
    // Discord uses es-ES for Spain and es-419 for Latin America
    const localeToDiscordLocale = {
        "es-ES": ["es-ES", "es-419"], // Use Spanish translation for both Spain and Latin America
        // Add more mappings as we add more locales
    };

    for (const [locale, discordLocales] of Object.entries(localeToDiscordLocale)) {
        const translation = _t(key, { lng: locale });
        // Only add if translation exists and is different from the key
        if (translation && translation !== key) {
            // Handle multiple Discord locale codes for same translation
            const localeArray = Array.isArray(discordLocales) ? discordLocales : [discordLocales];
            for (const discordLocale of localeArray) {
                localizations[discordLocale] = translation;
            }
        }
    }

    return localizations;
}
