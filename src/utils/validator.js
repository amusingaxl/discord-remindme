import { CONFIG } from "../constants/config.js";

export class Validator {
    static validateDiscordId(id) {
        return /^\d{17,19}$/.test(id);
    }

    static validateMessageLength(message) {
        return !message || message.length <= CONFIG.LIMITS.MESSAGE_MAX_LENGTH;
    }

    static validateTimeString(timeString) {
        return (
            timeString &&
            timeString.length <= CONFIG.LIMITS.TIME_STRING_MAX_LENGTH &&
            !/[<>{}[\]\\]/.test(timeString)
        );
    }

    static validateDiscordUrl(url) {
        return /^https:\/\/discord\.com\/channels\/((@me|\d+)\/\d+\/\d+)$/.test(
            url,
        );
    }

    static sanitizeInput(input, maxLength) {
        if (!input || typeof input !== "string") return "";
        return input.trim().substring(0, maxLength);
    }

    static validateTimezone(timezone) {
        return (
            timezone &&
            timezone.length <= CONFIG.LIMITS.TIMEZONE_MAX_LENGTH &&
            /^[A-Za-z0-9_/+-]+$/.test(timezone)
        );
    }
}
