import { Client, GatewayIntentBits, Collection } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ReminderScheduler from "./utils/scheduler.js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

const loadCommands = async () => {
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = await import(`file://${filePath}`);

        if ("data" in command.default && "execute" in command.default) {
            client.commands.set(command.default.data.name, command.default);
            console.log(`📝 Loaded command: ${command.default.data.name}`);
        } else {
            console.log(
                `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
            );
        }
    }
};

await loadCommands();

console.log(
    `🎯 Loaded ${client.commands.size} commands:`,
    Array.from(client.commands.keys()),
);

// Initialize scheduler
const scheduler = new ReminderScheduler(client);

client.once("ready", () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`🔧 Bot intents:`, client.options.intents.bitfield);
    console.log(`🏠 Bot is in ${client.guilds.cache.size} servers:`);
    client.guilds.cache.forEach((guild) => {
        console.log(
            `  - ${guild.name} (${guild.id}) - ${guild.memberCount} members`,
        );
    });
    scheduler.start();
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down gracefully...");
    scheduler.stop();
    await client.destroy();
    process.exit(0);
});

// Track processed interactions to prevent duplicates
const processedInteractions = new Set();

// Handle regular message commands (!remind)
client.on("messageCreate", async (message) => {
    // Ignore bot messages and non-commands
    if (message.author.bot || !message.content.startsWith("!remind")) return;

    try {
        await handleRemindCommand(message);
    } catch (error) {
        console.error("Error handling !remind command:", error);
        try {
            await message.reply(
                "❌ There was an error processing your reminder command. Please try again.",
            );
        } catch (replyError) {
            console.error("Failed to send error message:", replyError);
        }
    }
});

// Handle remind message command
async function handleRemindCommand(message) {
    // Parse command: !remind [@user] <time> [message]
    const content = message.content.slice(8).trim(); // Remove "!remind "
    if (!content) {
        return await message.reply({
            content:
                '❌ Please provide a time. Usage: `!remind "in 1 hour" message` or `!remind @user "in 1 hour" message`',
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
                content:
                    '❌ Unclosed quote. Use: `!remind "in 1 hour" message` or `!remind @user "in 1 hour" message`',
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

    if (message.reference && message.reference.messageId) {
        try {
            referencedMessage = await message.channel.messages.fetch(
                message.reference.messageId,
            );
            referencedMessageId = referencedMessage.id;
            referencedMessageUrl = `https://discord.com/channels/${message.guild?.id || "@me"}/${referencedMessage.channel.id}/${referencedMessage.id}`;
        } catch (_error) {
            // Ignore error if message cannot be fetched
        }
    }

    // Determine final message
    let finalMessage = reminderMessage;
    if (!finalMessage && referencedMessage) {
        // Simple placeholder since we'll show the original message in the embed
        finalMessage = "Referenced message";
    } else if (!finalMessage) {
        return await message.reply({
            content: "❌ Please provide a message or reply to a message.",
            allowedMentions: { repliedUser: false },
        });
    }

    // Import required modules
    const database = (await import("./database/database.js")).default;
    const TimeParser = (await import("./utils/timeParser.js")).default;

    try {
        // Get user's timezone
        const user = await database.getUser(message.author.id);
        const userTimezone = user?.timezone || "UTC";

        // Parse time
        const parsedTime = TimeParser.parseTimeString(timeString, userTimezone);
        if (!parsedTime || !parsedTime.isValid) {
            return await message.reply({
                content:
                    '❌ Invalid time format. Try: "in 1 hour", "tomorrow at 3pm", etc.',
                allowedMentions: { repliedUser: false },
            });
        }

        // Create reminder
        const isRemindingOther =
            targetUser && targetUser.id !== message.author.id;
        await database.createReminder(
            message.author.id,
            isRemindingOther ? targetUser.id : null,
            message.guild?.id || null,
            message.channelId,
            finalMessage,
            parsedTime.date.toISOString(),
            userTimezone,
            referencedMessageId,
            referencedMessageUrl,
        );

        // Create users if they don't exist
        database.createUser(message.author.id).catch(() => {});
        if (isRemindingOther) {
            database.createUser(targetUser.id).catch(() => {});
        }

        const timeFormatted = TimeParser.formatReminderTime(
            parsedTime.date,
            userTimezone,
        );

        // Simple confirmation message
        const targetText = isRemindingOther
            ? ` for ${targetUser.username}`
            : "";
        await message.reply({
            content: `✅ Reminder set${targetText} for ${timeFormatted.relative}`,
            allowedMentions: { repliedUser: false, users: [] }, // Don't ping anyone in confirmation
        });
    } catch (error) {
        console.error("Error creating reminder:", error);
        await message.reply({
            content: "❌ Error creating reminder. Please try again.",
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
        if (processedInteractions.size > 100) {
            const firstId = processedInteractions.values().next().value;
            processedInteractions.delete(firstId);
        }

        // Check if interaction is still valid
        const now = Date.now();
        const interactionTime = interaction.createdTimestamp;
        const timeDiff = now - interactionTime;

        if (timeDiff > 2500) {
            // If interaction is older than 2.5 seconds
            return; // Skip old interactions
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error("Error executing command:", error);

            // Only try to respond if we haven't already responded
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content:
                            "There was an error while executing this command! Please try again.",
                        ephemeral: true,
                    });
                } catch (responseError) {
                    console.error(
                        "Failed to send error response:",
                        responseError.message,
                    );
                }
            }
        }
    } else if (interaction.isContextMenuCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error("Error executing context menu command:", error);

            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content:
                            "There was an error while executing this command! Please try again.",
                        ephemeral: true,
                    });
                } catch (responseError) {
                    console.error(
                        "Failed to send context menu error response:",
                        responseError.message,
                    );
                }
            }
        }
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error("Error handling autocomplete:", error);
        }
    } else if (interaction.isModalSubmit()) {
        try {
            await handleModalSubmit(interaction);
        } catch (error) {
            console.error("Error handling modal submit:", error);
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content:
                            "There was an error processing your reminder. Please try again.",
                        ephemeral: true,
                    });
                } catch (responseError) {
                    console.error(
                        "Failed to send modal error response:",
                        responseError.message,
                    );
                }
            }
        }
    }
});

// Handle modal submissions for message reminders
async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith("remind_modal_")) {
        const messageId = interaction.customId.replace("remind_modal_", "");
        const timeString =
            interaction.fields.getTextInputValue("reminder_time");
        const customMessage =
            interaction.fields.getTextInputValue("reminder_message");

        // Get the original message for context
        let originalMessage;
        try {
            originalMessage =
                await interaction.channel.messages.fetch(messageId);
        } catch (error) {
            console.error("Could not fetch original message:", error);
            return await interaction.reply({
                content:
                    "Could not find the original message. It may have been deleted.",
                ephemeral: true,
            });
        }

        // Import the required modules
        const { EmbedBuilder } = await import("discord.js");
        const database = (await import("./database/database.js")).default;
        const TimeParser = (await import("./utils/timeParser.js")).default;

        try {
            // Get user's timezone preference
            const user = await database.getUser(interaction.user.id);
            const userTimezone = user?.timezone || "UTC";

            // Parse time with user's timezone
            const parsedTime = TimeParser.parseTimeString(
                timeString,
                userTimezone,
            );
            if (!parsedTime || !parsedTime.isValid) {
                const embed = new EmbedBuilder()
                    .setColor("#ff4444")
                    .setTitle("❌ Invalid Time Format")
                    .setDescription(
                        "I couldn't understand that time format. Here are some examples:",
                    )
                    .addFields({
                        name: "Valid formats:",
                        value: TimeParser.getTimeExamples().join("\n"),
                    })
                    .setFooter({
                        text: "Try again with a different time format",
                    });

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true,
                });
            }

            // Use custom message or original message content
            const reminderMessage =
                customMessage ||
                `Message from ${originalMessage.author.username}: ${originalMessage.content || "[Attachment/Embed]"}`;

            // Create message URL
            const messageUrl = `https://discord.com/channels/${interaction.guild?.id || "@me"}/${originalMessage.channel.id}/${originalMessage.id}`;

            // Create reminder with message reference
            const reminderId = await database.createReminder(
                interaction.user.id,
                null, // Self reminder only for now
                interaction.guild?.id || null,
                interaction.channelId,
                reminderMessage,
                parsedTime.date.toISOString(),
                userTimezone,
                originalMessage.id,
                messageUrl,
            );

            // Create users if they don't exist (async, don't wait)
            database.createUser(interaction.user.id).catch(() => {});

            const timeFormatted = TimeParser.formatReminderTime(
                parsedTime.date,
                userTimezone,
            );

            const embed = new EmbedBuilder()
                .setColor("#00ff88")
                .setTitle("✅ Message Reminder Created")
                .setDescription(
                    `I'll remind you about this message: **${reminderMessage.substring(0, 100)}${reminderMessage.length > 100 ? "..." : ""}**`,
                )
                .addFields(
                    {
                        name: "⏰ When",
                        value: `${timeFormatted.relative}\n(<t:${timeFormatted.timestamp}:F>)`,
                        inline: true,
                    },
                    { name: "🆔 ID", value: `${reminderId}`, inline: true },
                    {
                        name: "🔗 Original Message",
                        value: `[Jump to message](${messageUrl})`,
                        inline: true,
                    },
                )
                .setFooter({
                    text: `The reminder will include a link back to this message`,
                });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error("Error creating message reminder:", error);

            const embed = new EmbedBuilder()
                .setColor("#ff4444")
                .setTitle("❌ Error")
                .setDescription(
                    "Sorry, there was an error creating your message reminder. Please try again.",
                );

            try {
                if (interaction.replied) {
                    await interaction.followUp({
                        embeds: [embed],
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        embeds: [embed],
                        ephemeral: true,
                    });
                }
            } catch (replyError) {
                console.error("Failed to send error response:", replyError);
            }
        }
    }
}

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error("❌ DISCORD_TOKEN is not set in .env file");
    process.exit(1);
}

if (!process.env.DISCORD_APPLICATION_ID) {
    console.error("❌ DISCORD_APPLICATION_ID is not set in .env file");
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error("❌ Failed to login to Discord:", error.message);
    if (error.message.includes("401")) {
        console.error(
            "💡 Check that your DISCORD_TOKEN is correct and the bot is enabled",
        );
    }
    process.exit(1);
});
