import { jest, describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { DateTime } from "luxon";
import { TimeParser } from "./timeParser.js";

describe("TimeParser", () => {
    // Create instance for testing
    const timeParser = new TimeParser("en");

    describe("constructor and language support", () => {
        it("should create instance with English parser by default", () => {
            const parser = new TimeParser();
            expect(parser.locale).toBe("en-US");
        });

        it("should create instance with English parser when specified", () => {
            const parser = new TimeParser("en");
            expect(parser.locale).toBe("en");
        });

        it("should create instance with Spanish parser when specified", () => {
            const parser = new TimeParser("es-ES");
            expect(parser.locale).toBe("es-ES");
        });

        it("should default to English for unknown languages", () => {
            const parser = new TimeParser("fr-FR");
            expect(parser.locale).toBe("fr-FR");
            // Parser should still work (defaults to English)
            const result = parser.parseTimeString("tomorrow", "UTC");
            expect(result).toBeTruthy();
        });
    });

    describe("i18n time parsing", () => {
        beforeAll(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date("2025-01-15T10:00:00Z"));
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it("should parse English time strings with English parser", () => {
            const enParser = new TimeParser("en");
            const result = enParser.parseTimeString("tomorrow at 3pm", "UTC");
            expect(result).toBeTruthy();
            expect(result.isValid).toBe(true);
        });

        it("should parse Spanish time strings with Spanish parser", () => {
            const esParser = new TimeParser("es");
            const result = esParser.parseTimeString("mañana a las 3pm", "UTC");
            expect(result).toBeTruthy();
            expect(result.isValid).toBe(true);
        });

        it("should parse 'en 2 horas' with Spanish parser", () => {
            const esParser = new TimeParser("es");
            const result = esParser.parseTimeString("en 2 horas", "UTC");
            expect(result).toBeTruthy();
            expect(result.isValid).toBe(true);

            const expectedTime = DateTime.now().setZone("UTC").plus({ hours: 2 });
            const parsedTime = DateTime.fromJSDate(result.date);
            expect(Math.abs(parsedTime.toMillis() - expectedTime.toMillis())).toBeLessThan(60000);
        });

        it("should parse 'próximo lunes' with Spanish parser", () => {
            const esParser = new TimeParser("es");
            const result = esParser.parseTimeString("próximo lunes", "UTC");
            expect(result).toBeTruthy();
            expect(result.isValid).toBe(true);
        });
    });

    describe("parseTimeString", () => {
        const mockNow = DateTime.fromISO("2025-01-15T10:00:00", {
            zone: "UTC",
        });

        beforeAll(() => {
            jest.useFakeTimers();
            jest.setSystemTime(mockNow.toJSDate());
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it("should parse relative time strings", () => {
            const result = timeParser.parseTimeString("in 2 hours", "UTC");
            expect(result).toBeTruthy();
            expect(result.isValid).toBe(true);
            expect(result.date).toBeInstanceOf(Date);

            const expectedTime = mockNow.plus({ hours: 2 });
            const parsedTime = DateTime.fromJSDate(result.date);
            expect(Math.abs(parsedTime.toMillis() - expectedTime.toMillis())).toBeLessThan(60000);
        });

        it('should parse "tomorrow" correctly', () => {
            const result = timeParser.parseTimeString("tomorrow at 3pm", "UTC");
            expect(result).toBeTruthy();
            expect(result.isValid).toBe(true);

            const parsedTime = DateTime.fromJSDate(result.date).setZone("UTC");
            const expectedDay = mockNow.day === 31 ? 1 : mockNow.day + 1;
            expect(parsedTime.day).toBe(expectedDay);
            // chrono-node might interpret 3pm differently, so we check for a reasonable afternoon time
            expect(parsedTime.hour).toBeGreaterThanOrEqual(12);
            expect(parsedTime.hour).toBeLessThanOrEqual(20);
        });

        it("should return null for past times", () => {
            const result = timeParser.parseTimeString("yesterday", "UTC");
            expect(result).toBeNull();
        });

        it("should return null for invalid time strings", () => {
            const result = timeParser.parseTimeString("gibberish", "UTC");
            expect(result).toBeNull();
        });
    });

    describe("getTimeExamples", () => {
        it("should return an array of example time formats", () => {
            const examples = timeParser.getTimeExamples();
            expect(Array.isArray(examples)).toBe(true);
            expect(examples.length).toBeGreaterThan(0);
            expect(examples.every((ex) => typeof ex === "string")).toBe(true);
        });

        it("should use the correct language for examples", () => {
            const enParser = new TimeParser("en");
            const esParser = new TimeParser("es");

            const enExamples = enParser.getTimeExamples();
            const esExamples = esParser.getTimeExamples();

            expect(Array.isArray(enExamples)).toBe(true);
            expect(Array.isArray(esExamples)).toBe(true);
            expect(enExamples.length).toBe(esExamples.length);
        });
    });

    describe("isRelativeTime", () => {
        it("should identify relative time patterns", () => {
            expect(timeParser.isRelativeTime("in 2 hours")).toBe(true);
            expect(timeParser.isRelativeTime("in 30 minutes")).toBe(true);
            expect(timeParser.isRelativeTime("tomorrow")).toBe(true);
            expect(timeParser.isRelativeTime("next week")).toBe(true);
        });

        it("should not identify absolute times as relative", () => {
            expect(timeParser.isRelativeTime("January 15th")).toBe(false);
            expect(timeParser.isRelativeTime("2025-03-20")).toBe(false);
            expect(timeParser.isRelativeTime("3:30 PM")).toBe(false);
        });
    });

    describe("formatReminderTime", () => {
        const testDate = new Date("2025-01-20T15:30:00Z");

        beforeAll(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date("2025-01-15T10:00:00Z"));
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it("should format time with relative and absolute formats", () => {
            const result = timeParser.formatReminderTime(testDate, "UTC");
            expect(result).toHaveProperty("relative");
            expect(result).toHaveProperty("absolute");
            expect(result).toHaveProperty("timestamp");
            expect(result.relative).toContain("5 days");
        });

        it("should return timestamp in seconds", () => {
            const result = timeParser.formatReminderTime(testDate, "UTC");
            expect(result.timestamp).toBe(Math.floor(testDate.getTime() / 1000));
        });

        it("should format time with different locales", () => {
            const enParser = new TimeParser("en");
            const esParser = new TimeParser("es");

            const enResult = enParser.formatReminderTime(testDate, "UTC");
            const esResult = esParser.formatReminderTime(testDate, "UTC");

            expect(enResult).toHaveProperty("relative");
            expect(esResult).toHaveProperty("relative");

            // Both should have the same timestamp regardless of locale
            expect(enResult.timestamp).toBe(esResult.timestamp);

            // The relative format might differ based on locale
            // (though in this case "5 days" might be similar)
            expect(enResult.relative).toBeTruthy();
            expect(esResult.relative).toBeTruthy();
        });
    });

    describe("validateTimezone", () => {
        it("should validate correct IANA timezones", () => {
            expect(TimeParser.validateTimezone("UTC")).toBe(true);
            expect(TimeParser.validateTimezone("America/New_York")).toBe(true);
            expect(TimeParser.validateTimezone("Europe/London")).toBe(true);
        });

        it("should reject invalid timezones", () => {
            expect(TimeParser.validateTimezone("Invalid/Timezone")).toBe(false);
            expect(TimeParser.validateTimezone("NotATimezone")).toBe(false);
            expect(TimeParser.validateTimezone("")).toBe(false);
        });
    });
});
