import * as chrono from "chrono-node";
import { DateTime, IANAZone } from "luxon";
import { t } from "../i18n/i18n.js";
import { getCurrentTimezone } from "../context/userPreferences.js";

export class TimeParser {
    constructor(locale = "en-US") {
        this.locale = locale;
        this.parser = TimeParser.#getParserForLocale(locale);
    }

    static #getParserForLocale(locale) {
        // Extract base language from locale
        const baseLanguage = (locale ?? "en-US").split("-")[0];
        switch (baseLanguage) {
            case "es":
                return chrono.es;
            case "en":
            default:
                return chrono.en;
        }
    }

    parseTimeString(timeString, userTimezone = null) {
        // Use context timezone if not provided
        const timezone = userTimezone ?? getCurrentTimezone();
        const now = DateTime.now().setZone(timezone);

        // Parse with the locale-specific parser
        const results = this.parser.parse(timeString, now.toJSDate(), {
            timezone: timezone,
            forwardDate: true, // Interpret ambiguous times as future
        });

        if (results.length === 0) {
            return null;
        }

        const result = results[0];

        // Get the parsed date - chrono-node handles timezones internally
        const parsedDate = DateTime.fromJSDate(result.date());

        // Final check: don't allow dates in the past
        if (parsedDate < now) {
            return null;
        }

        return {
            date: parsedDate.toUTC().toJSDate(),
            originalTimezone: timezone,
            displayTime: parsedDate.setZone(timezone).toFormat("yyyy-MM-dd HH:mm:ss ZZZZ"),
            isValid: true,
        };
    }

    isRelativeTime(timeString) {
        const relativePatterns = [
            /in\s+\d+\s+(minute|hour|day|week|month)s?/i,
            /\d+\s+(minute|hour|day|week|month)s?\s+(from\s+now|later)/i,
            /next\s+(minute|hour|day|week|month)/i,
            /tomorrow/i,
            /tonight/i,
            /this\s+(afternoon|evening|morning)/i,
        ];

        return relativePatterns.some((pattern) => pattern.test(timeString.toLowerCase()));
    }

    getTimeExamples() {
        return [
            t("timeExamples.relative", { lng: this.locale }),
            t("timeExamples.specific", { lng: this.locale }),
            t("timeExamples.dates", { lng: this.locale }),
            t("timeExamples.natural", { lng: this.locale }),
        ];
    }

    formatReminderTime(date, timezone = null) {
        // Use context timezone if not provided
        const tz = timezone ?? getCurrentTimezone();
        const reminderDate = DateTime.fromJSDate(date).setZone(tz);
        const now = DateTime.now().setZone(tz);

        // Use Intl.RelativeTimeFormat for i18n support with the stored locale
        const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: "auto" });

        // Calculate the difference in milliseconds
        const diffMs = reminderDate.toMillis() - now.toMillis();
        const absMs = Math.abs(diffMs);
        const sign = diffMs > 0 ? 1 : -1;

        // Define thresholds and choose the best unit
        const units = [
            { unit: "second", ms: 1000, threshold: 45 * 1000 }, // < 45 seconds (use seconds)
            { unit: "minute", ms: 60 * 1000, threshold: 45 * 60 * 1000 }, // < 45 minutes (use minutes)
            { unit: "hour", ms: 60 * 60 * 1000, threshold: 22 * 60 * 60 * 1000 }, // < 22 hours (use hours)
            { unit: "day", ms: 24 * 60 * 60 * 1000, threshold: 6 * 24 * 60 * 60 * 1000 }, // < 6 days (use days)
            { unit: "week", ms: 7 * 24 * 60 * 60 * 1000, threshold: 3.5 * 7 * 24 * 60 * 60 * 1000 }, // < 3.5 weeks (use weeks)
            { unit: "month", ms: 30 * 24 * 60 * 60 * 1000, threshold: 11 * 30 * 24 * 60 * 60 * 1000 }, // < 11 months (use months)
            { unit: "year", ms: 365 * 24 * 60 * 60 * 1000, threshold: Infinity },
        ];

        // Find the appropriate unit
        let selectedUnit = units[0];
        for (const unitInfo of units) {
            if (absMs < unitInfo.threshold) {
                selectedUnit = unitInfo;
                break;
            }
        }

        // Calculate the value for the selected unit and round it
        const value = Math.round((sign * absMs) / selectedUnit.ms);
        const relativeTime = rtf.format(value, selectedUnit.unit);

        const fullFormat = reminderDate.toFormat("yyyy-MM-dd 'at' h:mm a ZZZZ");

        return {
            relative: relativeTime,
            absolute: fullFormat,
            timestamp: Math.floor(reminderDate.toMillis() / 1000),
        };
    }

    static getSupportedTimezones() {
        // Get all IANA timezone names that Luxon supports
        // We'll use Intl API to get supported timezones
        const allTimezones = Intl.supportedValuesOf("timeZone");

        // Filter out some deprecated/less common ones and prioritize popular ones
        const popularTimezones = [
            "UTC",
            // Americas
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "America/Toronto",
            "America/Vancouver",
            "America/Mexico_City",
            "America/Sao_Paulo",
            "America/Argentina/Buenos_Aires",
            "America/Santiago",
            "America/Lima",
            "America/Bogota",
            "America/Caracas",
            // Europe
            "Europe/London",
            "Europe/Paris",
            "Europe/Berlin",
            "Europe/Madrid",
            "Europe/Rome",
            "Europe/Amsterdam",
            "Europe/Brussels",
            "Europe/Vienna",
            "Europe/Zurich",
            "Europe/Stockholm",
            "Europe/Oslo",
            "Europe/Copenhagen",
            "Europe/Helsinki",
            "Europe/Warsaw",
            "Europe/Prague",
            "Europe/Budapest",
            "Europe/Athens",
            "Europe/Istanbul",
            "Europe/Moscow",
            "Europe/Kiev",
            // Asia
            "Asia/Tokyo",
            "Asia/Shanghai",
            "Asia/Hong_Kong",
            "Asia/Singapore",
            "Asia/Seoul",
            "Asia/Taipei",
            "Asia/Bangkok",
            "Asia/Jakarta",
            "Asia/Manila",
            "Asia/Kuala_Lumpur",
            "Asia/Mumbai",
            "Asia/Kolkata",
            "Asia/Delhi",
            "Asia/Karachi",
            "Asia/Dhaka",
            "Asia/Dubai",
            "Asia/Riyadh",
            "Asia/Tehran",
            "Asia/Baghdad",
            "Asia/Jerusalem",
            // Pacific
            "Australia/Sydney",
            "Australia/Melbourne",
            "Australia/Brisbane",
            "Australia/Perth",
            "Australia/Adelaide",
            "Pacific/Auckland",
            "Pacific/Fiji",
            "Pacific/Honolulu",
            // Africa
            "Africa/Cairo",
            "Africa/Lagos",
            "Africa/Johannesburg",
            "Africa/Nairobi",
            "Africa/Casablanca",
        ];

        // Combine popular timezones with all available ones, removing duplicates
        const combined = [...new Set([...popularTimezones, ...allTimezones])];

        return combined.sort();
    }

    static validateTimezone(timezone) {
        return IANAZone.create(timezone).isValid;
    }
}
