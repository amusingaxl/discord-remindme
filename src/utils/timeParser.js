import * as chrono from "chrono-node";
import { DateTime, IANAZone } from "luxon";

export class TimeParser {
    static parseTimeString(timeString, userTimezone = "UTC") {
        const now = DateTime.now().setZone(userTimezone);

        // Let chrono-node handle all parsing with forwardDate to ensure future times
        const results = chrono.parse(timeString, now.toJSDate(), {
            timezone: userTimezone,
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
            originalTimezone: userTimezone,
            displayTime: parsedDate
                .setZone(userTimezone)
                .toFormat("yyyy-MM-dd HH:mm:ss ZZZZ"),
            isValid: true,
        };
    }

    static isRelativeTime(timeString) {
        const relativePatterns = [
            /in\s+\d+\s+(minute|hour|day|week|month)s?/i,
            /\d+\s+(minute|hour|day|week|month)s?\s+(from\s+now|later)/i,
            /next\s+(minute|hour|day|week|month)/i,
            /tomorrow/i,
            /tonight/i,
            /this\s+(afternoon|evening|morning)/i,
        ];

        return relativePatterns.some((pattern) =>
            pattern.test(timeString.toLowerCase()),
        );
    }

    static getTimeExamples() {
        return [
            '• **Relative times:** "in 2 hours", "in 30 minutes", "in 1 day"',
            '• **Specific times:** "tomorrow at 3pm", "next friday at 9am"',
            '• **Dates:** "January 15th at 2pm", "2025-03-20 14:30"',
            '• **Natural language:** "tonight", "this evening", "next week"',
        ];
    }

    static formatReminderTime(date, timezone = "UTC", locale = "en-US") {
        const reminderDate = DateTime.fromJSDate(date).setZone(timezone);
        const now = DateTime.now().setZone(timezone);

        const diffMs = reminderDate.toMillis() - now.toMillis();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));

        // Use Intl.RelativeTimeFormat for better i18n support
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
        let timeDisplay = "";

        // Choose the most appropriate unit
        if (Math.abs(diffSeconds) < 60) {
            timeDisplay = rtf.format(diffSeconds, "second");
        } else if (Math.abs(diffMinutes) < 60) {
            timeDisplay = rtf.format(diffMinutes, "minute");
        } else if (Math.abs(diffHours) < 24) {
            timeDisplay = rtf.format(diffHours, "hour");
        } else if (Math.abs(diffDays) < 7) {
            timeDisplay = rtf.format(diffDays, "day");
        } else if (Math.abs(diffWeeks) < 4) {
            timeDisplay = rtf.format(diffWeeks, "week");
        } else {
            // For dates far in the future, use absolute format
            const dtf = new Intl.DateTimeFormat(locale, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
            timeDisplay = dtf.format(reminderDate.toJSDate());
        }

        const fullFormat = reminderDate.toFormat("yyyy-MM-dd 'at' h:mm a ZZZZ");

        return {
            relative: timeDisplay,
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
