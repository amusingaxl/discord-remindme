import { describe, it, expect } from "@jest/globals";
import { CONFIG } from "../constants/config.js";
import { Validator } from "./validator.js";

describe("Validator", () => {
    describe("validateDiscordId", () => {
        it("should validate correct Discord IDs", () => {
            expect(Validator.validateDiscordId("12345678901234567")).toBe(true); // 17 digits
            expect(Validator.validateDiscordId("123456789012345678")).toBe(true); // 18 digits
            expect(Validator.validateDiscordId("1234567890123456789")).toBe(true); // 19 digits
        });

        it("should reject invalid Discord IDs", () => {
            expect(Validator.validateDiscordId("1234567890123456")).toBe(false); // 16 digits
            expect(Validator.validateDiscordId("12345678901234567890")).toBe(false); // 20 digits
            expect(Validator.validateDiscordId("abcdefghijklmnopq")).toBe(false); // not numeric
            expect(Validator.validateDiscordId("123456789012345a7")).toBe(false); // contains letter
            expect(Validator.validateDiscordId("")).toBe(false);
            expect(Validator.validateDiscordId(null)).toBe(false);
            expect(Validator.validateDiscordId(undefined)).toBe(false);
        });
    });

    describe("validateMessageLength", () => {
        it("should accept messages within the limit", () => {
            expect(Validator.validateMessageLength("")).toBe(true);
            expect(Validator.validateMessageLength("Hello")).toBe(true);
            expect(Validator.validateMessageLength("a".repeat(2000))).toBe(true);
            expect(Validator.validateMessageLength(null)).toBe(true);
            expect(Validator.validateMessageLength(undefined)).toBe(true);
        });

        it("should reject messages exceeding the limit", () => {
            const tooLong = "a".repeat(CONFIG.LIMITS.MESSAGE_MAX_LENGTH + 1);
            expect(Validator.validateMessageLength(tooLong)).toBe(false);
        });
    });

    describe("validateTimeString", () => {
        it("should accept valid time strings", () => {
            expect(Validator.validateTimeString("in 2 hours")).toBe(true);
            expect(Validator.validateTimeString("tomorrow at 3pm")).toBe(true);
            expect(Validator.validateTimeString("2025-03-20 14:30")).toBe(true);
            expect(Validator.validateTimeString("next friday")).toBe(true);
        });

        it("should reject invalid time strings", () => {
            expect(Validator.validateTimeString("")).toBeFalsy();
            expect(Validator.validateTimeString(null)).toBeFalsy();
            expect(Validator.validateTimeString(undefined)).toBeFalsy();

            // Too long
            const tooLong = "a".repeat(CONFIG.LIMITS.TIME_STRING_MAX_LENGTH + 1);
            expect(Validator.validateTimeString(tooLong)).toBe(false);

            // Contains invalid characters
            expect(Validator.validateTimeString("in <script>2</script> hours")).toBe(false);
            expect(Validator.validateTimeString("tomorrow {alert('xss')}")).toBe(false);
            expect(Validator.validateTimeString("[malicious]")).toBe(false);
            expect(Validator.validateTimeString("test\\command")).toBe(false);
        });
    });

    describe("validateDiscordUrl", () => {
        it("should accept valid Discord URLs", () => {
            // Guild channel message
            expect(
                Validator.validateDiscordUrl(
                    "https://discord.com/channels/123456789012345678/123456789012345678/123456789012345678",
                ),
            ).toBe(true);

            // DM message
            expect(
                Validator.validateDiscordUrl("https://discord.com/channels/@me/123456789012345678/123456789012345678"),
            ).toBe(true);
        });

        it("should reject invalid Discord URLs", () => {
            // Wrong domain
            expect(Validator.validateDiscordUrl("https://discordapp.com/channels/123/456/789")).toBe(false);

            // HTTP instead of HTTPS
            expect(Validator.validateDiscordUrl("http://discord.com/channels/123/456/789")).toBe(false);

            // Missing parts
            expect(Validator.validateDiscordUrl("https://discord.com/channels/123/456")).toBe(false);

            // Extra parts
            expect(Validator.validateDiscordUrl("https://discord.com/channels/123/456/789/extra")).toBe(false);

            // Not a URL
            expect(Validator.validateDiscordUrl("not a url")).toBe(false);
            expect(Validator.validateDiscordUrl("")).toBe(false);
            expect(Validator.validateDiscordUrl(null)).toBe(false);
        });
    });

    describe("sanitizeInput", () => {
        it("should sanitize valid input", () => {
            expect(Validator.sanitizeInput("  hello  ", 10)).toBe("hello");
            expect(Validator.sanitizeInput("test", 10)).toBe("test");
            expect(Validator.sanitizeInput("long string", 4)).toBe("long");
        });

        it("should handle edge cases", () => {
            expect(Validator.sanitizeInput(null, 10)).toBe("");
            expect(Validator.sanitizeInput(undefined, 10)).toBe("");
            expect(Validator.sanitizeInput(123, 10)).toBe("");
            expect(Validator.sanitizeInput({}, 10)).toBe("");
            expect(Validator.sanitizeInput("", 10)).toBe("");
            expect(Validator.sanitizeInput("   ", 10)).toBe("");
        });

        it("should respect max length", () => {
            const longString = "This is a very long string that should be truncated";
            expect(Validator.sanitizeInput(longString, 10)).toBe("This is a ");
            expect(Validator.sanitizeInput(longString, 0)).toBe("");
        });
    });

    describe("validateTimezone", () => {
        it("should accept valid timezones", () => {
            expect(Validator.validateTimezone("UTC")).toBe(true);
            expect(Validator.validateTimezone("America/New_York")).toBe(true);
            expect(Validator.validateTimezone("Europe/London")).toBe(true);
            expect(Validator.validateTimezone("Asia/Tokyo")).toBe(true);
            expect(Validator.validateTimezone("GMT+5")).toBe(true);
            expect(Validator.validateTimezone("GMT-8")).toBe(true);
        });

        it("should reject invalid timezones", () => {
            expect(Validator.validateTimezone("")).toBeFalsy();
            expect(Validator.validateTimezone(null)).toBeFalsy();
            expect(Validator.validateTimezone(undefined)).toBeFalsy();

            // Too long
            const tooLong = "A".repeat(CONFIG.LIMITS.TIMEZONE_MAX_LENGTH + 1);
            expect(Validator.validateTimezone(tooLong)).toBe(false);

            // Invalid characters
            expect(Validator.validateTimezone("America/New York")).toBe(false); // space
            expect(Validator.validateTimezone("UTC!")).toBe(false);
            expect(Validator.validateTimezone("Europe@London")).toBe(false);
            expect(Validator.validateTimezone("Asia#Tokyo")).toBe(false);
        });
    });
});
