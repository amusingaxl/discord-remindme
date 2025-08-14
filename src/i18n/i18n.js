import { use, t as _t } from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";
import { fileURLToPath } from "url";
import { AsyncLocalStorage } from "node:async_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AsyncLocalStorage for storing user language context
const languageStorage = new AsyncLocalStorage();

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
 * Run a function with a specific locale context
 * @param {string} locale - Locale code (e.g., "en-US", "es-ES")
 * @param {function} callback - Function to run within the locale context
 */
export function withLocale(locale, callback) {
    return languageStorage.run(locale, callback);
}

/**
 * Get the current locale from context
 * @returns {string} Current locale or "en-US" as default
 */
export function getCurrentLocale() {
    return languageStorage.getStore() ?? "en-US";
}

/**
 * Translation function that uses AsyncLocalStorage for language context
 * @param {string} key - Translation key
 * @param {object} options - Translation options/variables
 * @returns {string} Translated string
 */
export function t(key, options = {}) {
    const locale = getCurrentLocale();
    return _t(key, { ...options, lng: locale });
}

/**
 * Get user's preferred locale from database or Discord locale
 * @param {object} interaction - Discord interaction or message
 * @param {object} userService - User service for database lookups
 * @returns {string} Locale code
 */
export function getLocale(interaction, userService) {
    const userId = interaction?.user?.id ?? interaction?.author?.id;

    // Check database for user preference
    if (userService && userId) {
        const dbLanguage = userService.getUserLanguage(userId);
        if (dbLanguage) {
            return dbLanguage;
        }
    }

    // Fall back to Discord locale
    const locale = interaction?.locale ?? interaction?.guildLocale ?? "en-US";

    // Map Discord locales to our supported locales
    const localeMap = {
        "en-US": "en-US",
        "en-GB": "en-US", // Map British English to US English
        "es-ES": "es-ES",
        "es-419": "es-ES", // Map Latin American Spanish to Spain Spanish
    };

    // If not in map, try to map language part to a supported locale
    if (!localeMap[locale]) {
        const lang = locale.split("-")[0];
        if (lang === "en") return "en-US";
        if (lang === "es") return "es-ES";
    }

    return localeMap[locale] ?? "en-US";
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
