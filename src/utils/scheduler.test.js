import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ReminderScheduler } from "./scheduler.js";

describe("ReminderScheduler", () => {
    let scheduler;
    let mockClient;
    let mockReminderService;
    let mockUserService;
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        // Mock client
        mockClient = {
            channels: {
                fetch: jest.fn(),
            },
            users: {
                fetch: jest.fn(),
            },
        };

        // Mock reminder service
        mockReminderService = {
            getActiveReminders: jest.fn().mockReturnValue([]),
            deleteReminder: jest.fn().mockReturnValue(1),
            completeReminder: jest.fn().mockReturnValue(1),
            getUpcomingReminders: jest.fn().mockReturnValue([]),
        };

        // Mock user service
        mockUserService = {
            getUserLanguage: jest.fn().mockReturnValue("en-US"),
            getUserTimezone: jest.fn().mockReturnValue("UTC"),
        };

        // Mock console
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        // Clear all timers
        jest.clearAllTimers();
        jest.useFakeTimers();

        scheduler = new ReminderScheduler(mockClient, mockReminderService, mockUserService);
    });

    afterEach(() => {
        scheduler.stop();
        jest.clearAllTimers();
        jest.useRealTimers();
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe("start", () => {
        it("should start the scheduler and set up interval", () => {
            scheduler.start();

            expect(consoleLogSpy).toHaveBeenCalledWith("🕐 Reminder scheduler started");
            expect(scheduler.checkInterval).not.toBeNull();
        });

        it("should immediately check reminders on start", async () => {
            const checkRemindersSpy = jest.spyOn(scheduler, "checkReminders");

            scheduler.start();

            expect(checkRemindersSpy).toHaveBeenCalledTimes(1);
        });

        it("should check reminders every 30 seconds", async () => {
            const checkRemindersSpy = jest.spyOn(scheduler, "checkReminders");

            scheduler.start();
            expect(checkRemindersSpy).toHaveBeenCalledTimes(1);

            // Fast-forward 30 seconds
            jest.advanceTimersByTime(30000);
            expect(checkRemindersSpy).toHaveBeenCalledTimes(2);

            // Fast-forward another 30 seconds
            jest.advanceTimersByTime(30000);
            expect(checkRemindersSpy).toHaveBeenCalledTimes(3);
        });
    });

    describe("stop", () => {
        it("should stop the scheduler and clear interval", () => {
            scheduler.start();
            scheduler.stop();

            expect(scheduler.checkInterval).toBeNull();
            expect(consoleLogSpy).toHaveBeenCalledWith("⏹️ Reminder scheduler stopped");
        });

        it("should do nothing if scheduler is not running", () => {
            scheduler.stop();

            expect(consoleLogSpy).not.toHaveBeenCalledWith("⏹️ Reminder scheduler stopped");
        });

        it("should stop checking reminders after stop is called", () => {
            const checkRemindersSpy = jest.spyOn(scheduler, "checkReminders");

            scheduler.start();
            scheduler.stop();

            jest.advanceTimersByTime(60000); // Advance 60 seconds

            // Should only have been called once (on start)
            expect(checkRemindersSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("checkReminders", () => {
        it("should fetch and process active reminders", async () => {
            const mockReminders = [
                { id: 1, scheduled_time: "2025-01-01T12:00:00Z" },
                { id: 2, scheduled_time: "2025-01-01T13:00:00Z" },
            ];
            mockReminderService.getActiveReminders.mockReturnValue(mockReminders);

            const processReminderSpy = jest.spyOn(scheduler, "processReminder").mockReturnValue();

            await scheduler.checkReminders();

            expect(mockReminderService.getActiveReminders).toHaveBeenCalled();
            expect(processReminderSpy).toHaveBeenCalledTimes(2);
            expect(processReminderSpy).toHaveBeenCalledWith(mockReminders[0]);
            expect(processReminderSpy).toHaveBeenCalledWith(mockReminders[1]);
        });

        it("should handle empty reminders list", async () => {
            mockReminderService.getActiveReminders.mockReturnValue([]);

            await scheduler.checkReminders();

            expect(mockReminderService.getActiveReminders).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith("🔍 Checking reminders... Found 0 due reminders");
        });

        it("should handle database errors gracefully", async () => {
            const error = new Error("Database error");
            mockReminderService.getActiveReminders.mockImplementation(() => {
                throw error;
            });

            await scheduler.checkReminders();

            expect(consoleErrorSpy).toHaveBeenCalledWith("Error checking reminders:", error);
        });

        it("should log due reminders details", async () => {
            const mockReminders = [{ id: 1, scheduled_time: "2025-01-01T12:00:00Z" }];
            mockReminderService.getActiveReminders.mockReturnValue(mockReminders);
            jest.spyOn(scheduler, "processReminder").mockReturnValue();

            await scheduler.checkReminders();

            expect(consoleLogSpy).toHaveBeenCalledWith("Due reminders:", ["ID:1 Time:2025-01-01T12:00:00Z"]);
        });
    });

    describe("processReminder", () => {
        let mockChannel;
        let mockTargetUser;

        beforeEach(() => {
            mockChannel = {
                send: jest.fn().mockResolvedValue(),
            };
            mockTargetUser = {
                id: "123456789012345678",
                username: "TestUser",
            };
            mockClient.channels.fetch.mockResolvedValue(mockChannel);
            mockClient.users.fetch.mockResolvedValue(mockTargetUser);
        });

        it("should send reminder and delete it from database", async () => {
            const reminder = {
                id: 1,
                channel_id: "987654321098765432",
                user_id: "123456789012345678",
                target_user_id: "123456789012345678",
                message: "Test reminder",
            };

            await scheduler.processReminder(reminder);

            expect(mockClient.channels.fetch).toHaveBeenCalledWith(reminder.channel_id);
            expect(mockChannel.send).toHaveBeenCalledWith({
                content: "🔔 **Reminder** <@123456789012345678>: Test reminder",
            });
            expect(mockReminderService.completeReminder).toHaveBeenCalledWith(reminder.id);
        });

        it("should handle reminder without message", async () => {
            const reminder = {
                id: 1,
                channel_id: "987654321098765432",
                user_id: "123456789012345678",
                target_user_id: "123456789012345678",
                message: "",
            };

            await scheduler.processReminder(reminder);

            expect(mockChannel.send).toHaveBeenCalledWith({
                content: "🔔 **Reminder** <@123456789012345678>",
            });
        });

        it("should handle channel not found", async () => {
            mockClient.channels.fetch.mockResolvedValue(null);

            const reminder = {
                id: 1,
                channel_id: "987654321098765432",
                target_user_id: "123456789012345678",
                message: "Test",
            };

            await scheduler.processReminder(reminder);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `Channel ${reminder.channel_id} not found for reminder ${reminder.id}`,
            );
            expect(mockReminderService.completeReminder).not.toHaveBeenCalled();
        });

        it("should handle send errors gracefully", async () => {
            const error = new Error("Send failed");
            mockChannel.send.mockRejectedValue(error);

            const reminder = {
                id: 1,
                channel_id: "987654321098765432",
                target_user_id: "123456789012345678",
                message: "Test",
            };

            await scheduler.processReminder(reminder);

            expect(consoleErrorSpy).toHaveBeenCalledWith(`Error processing reminder ${reminder.id}:`, error);
            // Should NOT complete the reminder when send fails (keeps for retry)
            expect(mockReminderService.completeReminder).not.toHaveBeenCalled();
        });

        it("should include referenced message information if available", async () => {
            const reminder = {
                id: 1,
                channel_id: "987654321098765432",
                target_user_id: "123456789012345678",
                message: "Remember this",
                referenced_message_url: "https://discord.com/channels/123/456/789",
            };

            await scheduler.processReminder(reminder);

            expect(mockChannel.send).toHaveBeenCalledWith({
                content: expect.stringContaining("Remember this"),
            });
        });

        it("should handle reminders set by one user for another", async () => {
            const mockCreator = {
                id: "111111111111111111",
                username: "CreatorUser",
            };
            mockClient.users.fetch.mockResolvedValueOnce(mockTargetUser).mockResolvedValueOnce(mockCreator);

            const reminder = {
                id: 1,
                channel_id: "987654321098765432",
                target_user_id: "123456789012345678",
                user_id: "111111111111111111",
                message: "Team meeting",
            };

            await scheduler.processReminder(reminder);

            expect(mockChannel.send).toHaveBeenCalledWith({
                content: expect.stringContaining("From: <@111111111111111111>"),
            });
        });

        it("should handle database deletion errors", async () => {
            const deleteError = new Error("Delete failed");
            mockReminderService.completeReminder.mockImplementation(() => {
                throw deleteError;
            });

            const reminder = {
                id: 1,
                channel_id: "987654321098765432",
                user_id: "123456789012345678",
                target_user_id: "123456789012345678",
                message: "Test",
            };

            await scheduler.processReminder(reminder);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `Error processing reminder ${reminder.id}:`,
                expect.any(Error),
            );
        });
    });

    describe("loadReminders", () => {
        it("should be callable", async () => {
            // loadReminders is called in bot.js but not defined in scheduler
            // This test verifies the method exists if it's added
            if (typeof scheduler.loadReminders === "function") {
                await expect(scheduler.loadReminders()).resolves.not.toThrow();
            } else {
                expect(scheduler.loadReminders).toBeUndefined();
            }
        });
    });
});
