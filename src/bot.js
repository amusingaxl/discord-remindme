import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ReminderScheduler from './utils/scheduler.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const loadCommands = async () => {
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = await import(`file://${filePath}`);
        
        if ('data' in command.default && 'execute' in command.default) {
            client.commands.set(command.default.data.name, command.default);
            console.log(`📝 Loaded command: ${command.default.data.name}`);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
};

await loadCommands();

// Initialize scheduler
const scheduler = new ReminderScheduler(client);

client.once('ready', () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    scheduler.start();
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    scheduler.stop();
    await client.destroy();
    process.exit(0);
});

// Track processed interactions to prevent duplicates
const processedInteractions = new Set();

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        // Check for duplicate interactions
        if (processedInteractions.has(interaction.id)) {
            console.warn(`🔄 Duplicate interaction detected: ${interaction.id}`);
            return;
        }
        processedInteractions.add(interaction.id);

        // Clean up old interaction IDs (keep only last 100)
        if (processedInteractions.size > 100) {
            const firstId = processedInteractions.values().next().value;
            processedInteractions.delete(firstId);
        }

        console.log(`📋 Received command: /${interaction.commandName} from ${interaction.user.username}#${interaction.user.discriminator} (ID: ${interaction.id})`);

        // Check if interaction is still valid
        const now = Date.now();
        const interactionTime = interaction.createdTimestamp;
        const timeDiff = now - interactionTime;
        
        if (timeDiff > 2500) { // If interaction is older than 2.5 seconds
            console.warn(`⚠️ Interaction is ${timeDiff}ms old - may timeout`);
            return; // Skip old interactions
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Error executing command:', error);
            
            // Only try to respond if we haven't already responded
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ 
                        content: 'There was an error while executing this command! Please try again.', 
                        ephemeral: true 
                    });
                } catch (responseError) {
                    console.error('Failed to send error response:', responseError.message);
                }
            }
        }
    } else if (interaction.isContextMenuCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        console.log(`📋 Received context menu: ${interaction.commandName} from ${interaction.user.username}#${interaction.user.discriminator}`);

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Error executing context menu command:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ 
                        content: 'There was an error while executing this command! Please try again.', 
                        ephemeral: true 
                    });
                } catch (responseError) {
                    console.error('Failed to send context menu error response:', responseError.message);
                }
            }
        }
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error('Error handling autocomplete:', error);
        }
    } else if (interaction.isModalSubmit()) {
        try {
            await handleModalSubmit(interaction);
        } catch (error) {
            console.error('Error handling modal submit:', error);
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ 
                        content: 'There was an error processing your reminder. Please try again.', 
                        ephemeral: true 
                    });
                } catch (responseError) {
                    console.error('Failed to send modal error response:', responseError.message);
                }
            }
        }
    }
});

// Handle modal submissions for message reminders
async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith('remind_modal_')) {
        const messageId = interaction.customId.replace('remind_modal_', '');
        const timeString = interaction.fields.getTextInputValue('reminder_time');
        const customMessage = interaction.fields.getTextInputValue('reminder_message');
        
        console.log(`🔄 Processing modal reminder for message ${messageId}`);
        
        // Get the original message for context
        let originalMessage;
        try {
            originalMessage = await interaction.channel.messages.fetch(messageId);
        } catch (error) {
            console.error('Could not fetch original message:', error);
            return await interaction.reply({
                content: 'Could not find the original message. It may have been deleted.',
                ephemeral: true
            });
        }

        // Import the required modules
        const { EmbedBuilder } = await import('discord.js');
        const database = (await import('./database/database.js')).default;
        const TimeParser = (await import('./utils/timeParser.js')).default;

        try {
            // Parse time with UTC for quick validation
            const parsedTime = TimeParser.parseTimeString(timeString, 'UTC');
            if (!parsedTime || !parsedTime.isValid) {
                const embed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('❌ Invalid Time Format')
                    .setDescription('I couldn\'t understand that time format. Here are some examples:')
                    .addFields(
                        { name: 'Valid formats:', value: TimeParser.getTimeExamples().join('\n') }
                    )
                    .setFooter({ text: 'Try again with a different time format' });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Use custom message or original message content
            const reminderMessage = customMessage || `Message from ${originalMessage.author.username}: ${originalMessage.content || '[Attachment/Embed]'}`;
            
            // Create message URL
            const messageUrl = `https://discord.com/channels/${interaction.guild?.id || '@me'}/${originalMessage.channel.id}/${originalMessage.id}`;
            
            // Create reminder with message reference
            const reminderId = await database.createReminder(
                interaction.user.id,
                null, // Self reminder only for now
                interaction.guild?.id || null,
                interaction.channelId,
                reminderMessage,
                parsedTime.date.toISOString(),
                'UTC',
                originalMessage.id,
                messageUrl
            );

            console.log(`✅ Message reminder created with ID: ${reminderId}`);

            // Create users if they don't exist (async, don't wait)
            database.createUser(interaction.user.id).catch(() => {});

            const timeFormatted = TimeParser.formatReminderTime(parsedTime.date, 'UTC');

            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('✅ Message Reminder Created')
                .setDescription(`I'll remind you about this message: **${reminderMessage.substring(0, 100)}${reminderMessage.length > 100 ? '...' : ''}**`)
                .addFields(
                    { name: '⏰ When', value: `${timeFormatted.relative}\n(<t:${timeFormatted.timestamp}:F>)`, inline: true },
                    { name: '🆔 ID', value: `${reminderId}`, inline: true },
                    { name: '🔗 Original Message', value: `[Jump to message](${messageUrl})`, inline: true }
                )
                .setFooter({ text: `The reminder will include a link back to this message` });

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error creating message reminder:', error);
            
            const embed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('Sorry, there was an error creating your message reminder. Please try again.');

            try {
                if (interaction.replied) {
                    await interaction.followUp({ embeds: [embed], ephemeral: true });
                } else {
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            } catch (replyError) {
                console.error('Failed to send error response:', replyError);
            }
        }
    }
}

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is not set in .env file');
    process.exit(1);
}

if (!process.env.DISCORD_APPLICATION_ID) {
    console.error('❌ DISCORD_APPLICATION_ID is not set in .env file');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Failed to login to Discord:', error.message);
    if (error.message.includes('401')) {
        console.error('💡 Check that your DISCORD_TOKEN is correct and the bot is enabled');
    }
    process.exit(1);
});