import { Client, GatewayIntentBits, Collection, EmbedBuilder, MessageFlags } from "discord.js";
import helpCommand from "./commands/help.js";
import remindCommand from "./commands/remind.js";
import remindersCommand from "./commands/reminders.js";
import timezoneCommand from "./commands/timezone.js";
import languageCommand from "./commands/language.js";
import { CONFIG } from "./constants/config.js";
import { Database } from "./database/database.js";
import { ReminderService } from "./services/reminderService.js";
import { UserService } from "./services/userService.js";
import { ReminderScheduler } from "./utils/scheduler.js";
import { TimeParser } from "./utils/timeParser.js";
import { t } from "./i18n/i18n.js";
import { getUserPreferences, withPreferences, getCurrentTimezone } from "./context/userPreferences.js";

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN is not set in environment variables");
}

if (!process.env.DISCORD_APPLICATION_ID) {
    throw new Error("DISCORD_APPLICATION_ID is not set in environment variables");
}

// Initialize database with path from environment variable
if (!process.env.DATABASE_PATH) {
    throw new Error("DATABASE_PATH environment variable is required");
}

const database = new Database(process.env.DATABASE_PATH);

// Initialize services
const userService = new UserService(database);
const reminderService = new ReminderService(database, userService);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// Register all commands
const commands = [remindCommand, remindersCommand, timezoneCommand, languageCommand, helpCommand];

for (const command of commands) {
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        console.log(`📝 Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] Command is missing a required "data" or "execute" property.`);
    }
}

console.log(`🎯 Loaded ${client.commands.size} commands:`, Array.from(client.commands.keys()));

// Initialize scheduler with services
const scheduler = new ReminderScheduler(client, reminderService, userService);

client.once("ready", () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`🔧 Bot intents:`, client.options.intents.bitfield);
    console.log(`🏠 Bot is in ${client.guilds.cache.size} servers:`);
    client.guilds.cache.forEach((guild) => {
        console.log(`  - ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
    });
    scheduler.start();
});

// Handle graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

    try {
        scheduler.stop();
        console.log("✅ Scheduler stopped");

        await client.destroy();
        console.log("✅ Discord client disconnected");

        database.close();
        console.log("✅ Database connection closed");

        console.log("👋 Goodbye!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
    }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGUSR2", () => shutdown("SIGUSR2")); // Nodemon uses this for restart

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    shutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    shutdown("UNHANDLED_REJECTION");
});

// Track processed interactions to prevent duplicates
const processedInteractions = new Set();

// Handle regular message commands (!remind)
client.on("messageCreate", async (message) => {
    // Ignore bot messages and non-commands
    if (message.author.bot || !message.content.startsWith("!remind")) return;

    const preferences = getUserPreferences(message, userService);

    await withPreferences(preferences, async () => {
        const timeParser = new TimeParser(preferences.locale);
        try {
            await handleRemindCommand(message, timeParser);
        } catch (error) {
            console.error("Error handling !remind command:", error);
            try {
                await message.reply({
                    content: t("errors.commandError"),
                    allowedMentions: { repliedUser: false },
                });
            } catch (replyError) {
                console.error("Failed to send error message:", replyError);
            }
        }
    });
});

// Handle remind message command
async function handleRemindCommand(message, timeParser) {
    // Parse command: !remind [@user] <time> [message]
    const content = message.content.slice(8).trim(); // Remove "!remind "
    if (!content) {
        return await message.reply({
            content: t("errors.provideTime"),
            allowedMentions: { repliedUser: false },
        });
    }

    // Check for user mention at the beginning
    let targetUser = null;
    let remainingContent = content;
    const mentionMatch = content.match(/^<@!?(\d+)>\s*/);
    if (mentionMatch) {
        const userId = mentionMatch[1];
        targetUser = await message.client.users.fetch(userId).catch(() => null);
        remainingContent = content.slice(mentionMatch[0].length);
    }

    // Handle quoted time strings like !remind "in 1 hour" message
    let timeString, reminderMessage;
    if (remainingContent.startsWith('"')) {
        const endQuote = remainingContent.indexOf('"', 1);
        if (endQuote === -1) {
            return await message.reply({
                content: t("errors.unclosedQuote"),
                allowedMentions: { repliedUser: false },
            });
        }
        timeString = remainingContent.slice(1, endQuote);
        reminderMessage = remainingContent.slice(endQuote + 1).trim();
    } else {
        // Space-separated: take first word as time, rest as message
        const spaceIndex = remainingContent.indexOf(" ");
        if (spaceIndex === -1) {
            timeString = remainingContent;
            reminderMessage = "";
        } else {
            timeString = remainingContent.slice(0, spaceIndex);
            reminderMessage = remainingContent.slice(spaceIndex + 1);
        }
    }

    // Check for reply context
    let referencedMessage = null;
    let referencedMessageId = null;
    let referencedMessageUrl = null;

    if (message.reference?.messageId) {
        try {
            referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            referencedMessageId = referencedMessage.id;
            referencedMessageUrl = `https://discord.com/channels/${message.guild?.id ?? "@me"}/${referencedMessage.channel.id}/${referencedMessage.id}`;
        } catch {
            // Ignore error if message cannot be fetched
        }
    }

    // Determine final message
    let finalMessage = reminderMessage;
    if (!finalMessage && referencedMessage) {
        // Simple placeholder since we'll show the original message in the embed
        finalMessage = t("reminder.referencedMessage");
    } else if (!finalMessage) {
        return await message.reply({
            content: t("errors.provideMessage"),
            allowedMentions: { repliedUser: false },
        });
    }

    // Use imported modules

    try {
        // Parse time (will use timezone from context)
        const parsedTime = timeParser.parseTimeString(timeString);
        if (!parsedTime?.isValid) {
            return await message.reply({
                content: t("errors.invalidTime"),
                allowedMentions: { repliedUser: false },
            });
        }

        // Create reminder
        const isRemindingOther = targetUser && targetUser.id !== message.author.id;
        await reminderService.createReminder({
            userId: message.author.id,
            targetUserId: isRemindingOther ? targetUser.id : null,
            guildId: message.guild?.id ?? null,
            channelId: message.channelId,
            message: finalMessage,
            scheduledTime: parsedTime.date.toISOString(),
            timezone: getCurrentTimezone(),
            referencedMessageId: referencedMessageId,
            referencedMessageUrl: referencedMessageUrl,
        });

        const timeFormatted = timeParser.formatReminderTime(parsedTime.date);

        // Simple confirmation message
        const targetText = isRemindingOther ? ` for ${targetUser.username}` : "";
        await message.reply({
            content: t("success.reminderSetFor", {
                targetText: targetText,
                time: timeFormatted.relative,
            }),
            allowedMentions: { repliedUser: false, users: [] }, // Don't ping anyone in confirmation
        });
    } catch (error) {
        console.error("Error creating reminder:", error);
        await message.reply({
            content: t("errors.reminderCreationFailed"),
            allowedMentions: { repliedUser: false },
        });
    }
}

client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        // Check for duplicate interactions
        if (processedInteractions.has(interaction.id)) {
            return;
        }
        processedInteractions.add(interaction.id);

        // Clean up old interaction IDs (keep only last 100)
        if (processedInteractions.size > CONFIG.LIMITS.PROCESSED_INTERACTIONS_CACHE) {
            const firstId = processedInteractions.values().next().value;
            processedInteractions.delete(firstId);
        }

        try {
            // Get user preferences and set up context
            const preferences = getUserPreferences(interaction, userService);

            await withPreferences(preferences, async () => {
                const timeParser = new TimeParser(preferences.locale);

                await command.execute(interaction, {
                    userService,
                    reminderService,
                    timeParser,
                });
            });
        } catch (error) {
            console.error("Error executing command:", error);

            // Only try to respond if we haven't already responded
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: t("errors.executionError"),
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (responseError) {
                    console.error("Failed to send error response:", responseError.message);
                }
            } else if (interaction.deferred && !interaction.replied) {
                try {
                    await interaction.editReply({
                        content: t("errors.executionError"),
                    });
                } catch (responseError) {
                    console.error("Failed to send error response:", responseError.message);
                }
            }
        }
    } else if (interaction.isContextMenuCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            return;
        }

        const preferences = getUserPreferences(interaction, userService);

        await withPreferences(preferences, async () => {
            const timeParser = new TimeParser(preferences.locale);

            try {
                await command.execute(interaction, {
                    userService,
                    reminderService,
                    timeParser,
                });
            } catch (error) {
                console.error("Error executing context menu command:", error);

                if (!interaction.replied && !interaction.deferred) {
                    try {
                        await interaction.reply({
                            content: t("errors.executionError"),
                            flags: MessageFlags.Ephemeral,
                        });
                    } catch (responseError) {
                        console.error("Failed to send context menu error response:", responseError.message);
                    }
                }
            }
        });
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command?.autocomplete) return;

        try {
            // For autocomplete, we need to respond immediately without complex setup
            // Just pass the services directly without preferences context
            await command.autocomplete(interaction, {
                userService,
                reminderService,
                timeParser: new TimeParser(), // Use default locale for autocomplete
            });
        } catch (error) {
            console.error("Error handling autocomplete:", error);
        }
    } else if (interaction.isModalSubmit()) {
        const preferences = getUserPreferences(interaction, userService);

        await withPreferences(preferences, async () => {
            const timeParser = new TimeParser(preferences.locale);

            try {
                await handleModalSubmit(interaction, {
                    userService,
                    reminderService,
                    timeParser,
                });
            } catch (error) {
                console.error("Error handling modal submit:", error);
                if (!interaction.replied && !interaction.deferred) {
                    try {
                        await interaction.reply({
                            content: t("errors.processingError"),
                            flags: MessageFlags.Ephemeral,
                        });
                    } catch (responseError) {
                        console.error("Failed to send modal error response:", responseError.message);
                    }
                }
            }
        });
    }
});

// Handle modal submissions for message reminders
async function handleModalSubmit(interaction, { reminderService, timeParser }) {
    if (interaction.customId.startsWith("remind_modal_")) {
        const messageId = interaction.customId.replace("remind_modal_", "");
        const timeString = interaction.fields.getTextInputValue("reminder_time");
        const customMessage = interaction.fields.getTextInputValue("reminder_message");

        // Get the original message for context
        let originalMessage;
        try {
            originalMessage = await interaction.channel.messages.fetch(messageId);
        } catch (error) {
            console.error("Could not fetch original message:", error);
            return await interaction.reply({
                content: t("errors.originalMessageNotFound"),
                flags: MessageFlags.Ephemeral,
            });
        }

        // Use imported modules

        try {
            // Parse time (will use timezone from context)
            const parsedTime = timeParser.parseTimeString(timeString);
            if (!parsedTime?.isValid) {
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.ERROR)
                    .setTitle(t("errors.invalidTimeFormat"))
                    .setDescription(t("errors.cantUnderstandTimeFormat"))
                    .addFields({
                        name: t("fields.validFormats"),
                        value: timeParser.getTimeExamples().join("\n"),
                    })
                    .setFooter({
                        text: t("fields.tryAgain"),
                    });

                return await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Use custom message or original message content
            const reminderMessage =
                customMessage ??
                t("reminder.messageFrom", {
                    username: originalMessage.author.username,
                    content: originalMessage.content ?? t("reminder.attachmentPlaceholder"),
                });

            // Create message URL
            const messageUrl = `https://discord.com/channels/${interaction.guild?.id ?? "@me"}/${originalMessage.channel.id}/${originalMessage.id}`;

            // Create reminder with message reference
            const reminderId = await reminderService.createReminder({
                userId: interaction.user.id,
                targetUserId: null, // Self reminder only for now
                guildId: interaction.guild?.id ?? null,
                channelId: interaction.channelId,
                message: reminderMessage,
                scheduledTime: parsedTime.date.toISOString(),
                timezone: getCurrentTimezone(),
                referencedMessageId: originalMessage.id,
                referencedMessageUrl: messageUrl,
            });

            const timeFormatted = timeParser.formatReminderTime(parsedTime.date);

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.SUCCESS)
                .setTitle(t("success.messageReminderCreated"))
                .setDescription(
                    t("reminder.aboutMessage", {
                        preview: reminderMessage.substring(0, CONFIG.LIMITS.REMINDER_PREVIEW_LENGTH),
                        ellipsis: reminderMessage.length > CONFIG.LIMITS.REMINDER_PREVIEW_LENGTH ? "..." : "",
                    }),
                )
                .addFields(
                    {
                        name: t("fields.when"),
                        value: `${timeFormatted.relative}\n(<t:${timeFormatted.timestamp}:F>)`,
                        inline: true,
                    },
                    {
                        name: t("fields.id"),
                        value: `${reminderId}`,
                        inline: true,
                    },
                    {
                        name: t("fields.originalMessage"),
                        value: t("reminder.jumpToMessage", { url: messageUrl }),
                        inline: true,
                    },
                )
                .setFooter({
                    text: t("fields.reminderLinkFooter"),
                });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error("Error creating message reminder:", error);

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.ERROR)
                .setTitle(t("errors.generalError"))
                .setDescription(
                    t("errors.genericErrorMessage", {
                        action: "creating your message reminder",
                    }),
                );

            try {
                if (interaction.replied) {
                    await interaction.followUp({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } catch (replyError) {
                console.error("Failed to send error response:", replyError);
            }
        }
    }
}

client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error("❌ Failed to login to Discord:", error.message);
    if (error.message.includes("401")) {
        console.error("💡 Check that your DISCORD_TOKEN is correct and the bot is enabled");
    }
    process.exit(1);
});
