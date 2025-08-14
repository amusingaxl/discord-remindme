import { describe, it, expect } from "@jest/globals";
import { withTimeout } from "./timeout.js";

describe("withTimeout", () => {
    it("should resolve with the promise result if it completes before timeout", async () => {
        const promise = Promise.resolve("success");
        const result = await withTimeout(promise, 1000);
        expect(result).toBe("success");
    });

    it("should resolve with async function result if it completes before timeout", async () => {
        const asyncFunc = async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return "async success";
        };
        const result = await withTimeout(asyncFunc(), 1000);
        expect(result).toBe("async success");
    });

    it("should reject with timeout error if promise takes too long", async () => {
        const slowPromise = new Promise((resolve) =>
            setTimeout(() => resolve("too late"), 1000),
        );

        await expect(withTimeout(slowPromise, 100)).rejects.toThrow(
            "Operation timed out",
        );
    });

    it("should use custom error message when provided", async () => {
        const slowPromise = new Promise((resolve) =>
            setTimeout(() => resolve("too late"), 1000),
        );

        await expect(
            withTimeout(slowPromise, 100, "Custom timeout message"),
        ).rejects.toThrow("Custom timeout message");
    });

    it("should use default timeout of 2000ms when not specified", async () => {
        const startTime = Date.now();
        const slowPromise = new Promise(() => {}); // Never resolves

        try {
            await withTimeout(slowPromise);
        } catch (error) {
            const elapsed = Date.now() - startTime;
            expect(error.message).toBe("Operation timed out");
            // Allow some margin for test execution
            expect(elapsed).toBeGreaterThanOrEqual(1900);
            expect(elapsed).toBeLessThan(2200);
        }
    });

    it("should reject with original error if promise rejects before timeout", async () => {
        const rejectingPromise = Promise.reject(new Error("Original error"));

        await expect(withTimeout(rejectingPromise, 1000)).rejects.toThrow(
            "Original error",
        );
    });

    it("should handle immediate resolve", async () => {
        const immediatePromise = Promise.resolve("immediate");
        const result = await withTimeout(immediatePromise, 1000);
        expect(result).toBe("immediate");
    });

    it("should handle immediate reject", async () => {
        const immediateReject = Promise.reject(new Error("immediate error"));

        await expect(withTimeout(immediateReject, 1000)).rejects.toThrow(
            "immediate error",
        );
    });
});
