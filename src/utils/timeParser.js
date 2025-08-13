import * as chrono from "chrono-node";
import moment from "moment-timezone";

class TimeParser {
    static parseTimeString(timeString, userTimezone = "UTC") {
        const now = moment().tz(userTimezone);

        const results = chrono.parse(timeString, now.toDate(), {
            timezone: userTimezone === "UTC" ? undefined : userTimezone,
        });

        if (results.length === 0) {
            return null;
        }

        const result = results[0];
        let parsedDate = moment(result.date());

        if (userTimezone !== "UTC") {
            parsedDate = parsedDate.tz(userTimezone);
        }

        if (parsedDate.isBefore(now)) {
            if (this.isRelativeTime(timeString)) {
                parsedDate = parsedDate.add(1, "day");
            } else {
                return null;
            }
        }

        return {
            date: parsedDate.utc().toDate(),
            originalTimezone: userTimezone,
            displayTime: parsedDate.format("YYYY-MM-DD HH:mm:ss z"),
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

    static formatReminderTime(date, timezone = "UTC") {
        const momentDate = moment(date).tz(timezone);
        const now = moment().tz(timezone);

        const diffSeconds = momentDate.diff(now, "seconds");
        const diffMinutes = momentDate.diff(now, "minutes");
        const diffHours = momentDate.diff(now, "hours");
        const diffDays = momentDate.diff(now, "days");

        let timeDisplay = "";

        if (diffSeconds < 60) {
            timeDisplay = `in ${diffSeconds} second${diffSeconds !== 1 ? "s" : ""}`;
        } else if (diffMinutes < 60) {
            timeDisplay = `in ${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""}`;
        } else if (diffHours < 24) {
            timeDisplay = `in ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
        } else if (diffDays < 7) {
            timeDisplay = `in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
        } else {
            timeDisplay = momentDate.format("MMM Do, YYYY [at] h:mm A");
        }

        const fullFormat = momentDate.format("YYYY-MM-DD [at] h:mm A z");

        return {
            relative: timeDisplay,
            absolute: fullFormat,
            timestamp: Math.floor(momentDate.valueOf() / 1000),
        };
    }

    static getSupportedTimezones() {
        // Get all timezone names from moment-timezone
        const allTimezones = moment.tz.names();

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
        return moment.tz.zone(timezone) !== null;
    }
}

export default TimeParser;
