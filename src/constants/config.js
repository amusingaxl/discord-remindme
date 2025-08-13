export const CONFIG = {
    SCHEDULER: {
        CHECK_INTERVAL: 30000,
        MAX_REMINDERS_PER_CHECK: 100,
    },
    LIMITS: {
        MESSAGE_MAX_LENGTH: 2000,
        TIME_STRING_MAX_LENGTH: 100,
        TIMEZONE_MAX_LENGTH: 50,
        REMINDER_PREVIEW_LENGTH: 100,
        DM_PREVIEW_LENGTH: 150,
        MAX_REMINDERS_DISPLAY: 10,
        INTERACTION_TIMEOUT: 2500,
        PROCESSED_INTERACTIONS_CACHE: 100,
    },
    COLORS: {
        SUCCESS: "#00ff88",
        ERROR: "#ff4444",
        INFO: "#0099ff",
        WARNING: "#ffaa00",
        DISCORD: "#5865f2",
    },
    TIMEZONES: {
        DEFAULT: "UTC",
        AUTOCOMPLETE_LIMIT: 25,
    },
    RATE_LIMITS: {
        COMMANDS_PER_USER: 10,
        TIME_WINDOW: 60000, // 1 minute
    },
};

export const DISCORD_ERRORS = {
    UNKNOWN_CHANNEL: 10003,
    MISSING_PERMISSIONS: 50013,
    MISSING_ACCESS: 50001,
    UNKNOWN_MESSAGE: 10008,
    INVALID_TOKEN: 401,
};

export const MESSAGES = {
    ERRORS: {
        INVALID_TIME:
            '❌ Invalid time format. Try: "in 1 hour", "tomorrow at 3pm", etc.',
        INVALID_MESSAGE_LINK:
            '❌ Invalid Discord message link. Please copy the link by right-clicking a message and selecting "Copy Message Link".',
        MESSAGE_NOT_FOUND:
            "❌ Could not access the referenced message. Make sure the bot has permission to view that channel and the message exists.",
        REMINDER_CREATION_FAILED:
            "❌ Error creating reminder. Please try again.",
        COMMAND_ERROR:
            "❌ There was an error processing your command. Please try again.",
        RATE_LIMITED:
            "❌ You're sending commands too quickly. Please wait a moment.",
    },
    SUCCESS: {
        REMINDER_SET: "✅ Reminder set",
        REMINDER_DELETED: "✅ Reminder deleted",
        TIMEZONE_UPDATED: "✅ Timezone updated",
    },
};
