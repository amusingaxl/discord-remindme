import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { REST, Routes } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN is not set in .env file");
}

if (!process.env.DISCORD_APPLICATION_ID) {
    throw new Error("DISCORD_APPLICATION_ID is not set in .env file");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const commandsPath = path.join(__dirname, "commands");

const loadCommands = async () => {
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(`file://${filePath}`);
            if ("data" in command.default && "execute" in command.default) {
                commands.push(command.default.data.toJSON());
                console.log(`✅ Loaded command: ${command.default.data.name || file}`);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }
};

await loadCommands();

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID), { body: commands });

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
