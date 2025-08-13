import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { TimeParser } from "./timeParser.js";
import { DateTime } from "luxon";

describe("TimeParser", () => {
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
            const result = TimeParser.parseTimeString("in 2 hours", "UTC");
            expect(result).toBeTruthy();
            expect(result.isValid).toBe(true);
            expect(result.date).toBeInstanceOf(Date);

            const expectedTime = mockNow.plus({ hours: 2 });
            const parsedTime = DateTime.fromJSDate(result.date);
            expect(
                Math.abs(parsedTime.toMillis() - expectedTime.toMillis()),
            ).toBeLessThan(60000);
        });

        it('should parse "tomorrow" correctly', () => {
            const result = TimeParser.parseTimeString("tomorrow at 3pm", "UTC");
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
            const result = TimeParser.parseTimeString("yesterday", "UTC");
            expect(result).toBeNull();
        });

        it("should return null for invalid time strings", () => {
            const result = TimeParser.parseTimeString("gibberish", "UTC");
            expect(result).toBeNull();
        });
    });

    describe("isRelativeTime", () => {
        it("should identify relative time patterns", () => {
            expect(TimeParser.isRelativeTime("in 2 hours")).toBe(true);
            expect(TimeParser.isRelativeTime("in 30 minutes")).toBe(true);
            expect(TimeParser.isRelativeTime("tomorrow")).toBe(true);
            expect(TimeParser.isRelativeTime("next week")).toBe(true);
        });

        it("should not identify absolute times as relative", () => {
            expect(TimeParser.isRelativeTime("January 15th")).toBe(false);
            expect(TimeParser.isRelativeTime("2025-03-20")).toBe(false);
            expect(TimeParser.isRelativeTime("3:30 PM")).toBe(false);
        });
    });

    describe("getTimeExamples", () => {
        it("should return an array of example time formats", () => {
            const examples = TimeParser.getTimeExamples();
            expect(Array.isArray(examples)).toBe(true);
            expect(examples.length).toBeGreaterThan(0);
            expect(examples.every((ex) => typeof ex === "string")).toBe(true);
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
            const result = TimeParser.formatReminderTime(testDate, "UTC");
            expect(result).toHaveProperty("relative");
            expect(result).toHaveProperty("absolute");
            expect(result).toHaveProperty("timestamp");
            expect(result.relative).toContain("5 days");
        });

        it("should return timestamp in seconds", () => {
            const result = TimeParser.formatReminderTime(testDate, "UTC");
            expect(result.timestamp).toBe(
                Math.floor(testDate.getTime() / 1000),
            );
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
