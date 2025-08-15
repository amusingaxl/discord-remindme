import { AsyncLocalStorage } from "node:async_hooks";

/**
 * User preferences context for managing cross-cutting concerns like locale and timezone
 * Uses AsyncLocalStorage to maintain context across async operations
 */

// Create a single storage for all user preferences
const preferencesStorage = new AsyncLocalStorage();

/**
 * Default preferences when no context is available
 */
const DEFAULT_PREFERENCES = {
    locale: "en-US",
    timezone: "UTC",
};

/**
 * Get current user preferences from context
 * @returns {Object} User preferences with locale and timezone
 */
export function getCurrentPreferences() {
    return preferencesStorage.getStore() ?? DEFAULT_PREFERENCES;
}

/**
 * Get current timezone from preferences context
 * @returns {string} Current timezone or "UTC" as default
 */
export function getCurrentTimezone() {
    const preferences = getCurrentPreferences();
    return preferences.timezone;
}

/**
 * Run a function with specific user preferences context
 * @param {Object} preferences - User preferences object with locale and/or timezone
 * @param {function} callback - Function to run within the preferences context
 */
export function withPreferences(preferences, callback) {
    // Merge with current preferences to allow partial updates
    const currentPrefs = getCurrentPreferences();
    const mergedPrefs = { ...currentPrefs, ...preferences };
    return preferencesStorage.run(mergedPrefs, callback);
}

/**
 * Get user's preferences from database or Discord defaults
 * @param {object} interaction - Discord interaction or message
 * @param {object} userService - User service for database lookups
 * @returns {Object} User preferences object with locale and timezone
 */
export function getUserPreferences(interaction, userService) {
    const userId = interaction?.user?.id ?? interaction?.author?.id;

    // Default preferences
    let preferences = {
        locale: getDiscordLocale(interaction),
        timezone: "UTC",
    };

    // Override with database preferences if available
    if (userService && userId) {
        const dbLanguage = userService.getUserLanguage(userId);
        const dbTimezone = userService.getUserTimezone(userId);

        if (dbLanguage) {
            preferences.locale = dbLanguage;
        }
        if (dbTimezone) {
            preferences.timezone = dbTimezone;
        }
    }

    return preferences;
}

/**
 * Get Discord's locale from interaction
 * @param {object} interaction - Discord interaction or message
 * @returns {string} Mapped locale code
 */
function getDiscordLocale(interaction) {
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
