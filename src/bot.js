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

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Error executing command:', error);
            
            // Try to respond with error message if possible
            try {
                const errorMessage = { content: 'There was an error while executing this command! Please try again.', ephemeral: true };
                
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else if (interaction.replied) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (responseError) {
                // If we can't respond, just log it (interaction might have timed out)
                console.error('Failed to send error response:', responseError.message);
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
    }
});

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