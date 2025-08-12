# Discord Reminder Bot

A powerful Discord bot that allows users to create and manage reminders for themselves and others with natural language time parsing.

## Features

- ⏰ **Natural Time Parsing**: Use human-readable formats like "in 2 hours", "tomorrow at 3pm", or "next Friday"
- 👥 **Remind Others**: Create reminders for other users in your server
- 🌍 **Timezone Support**: Set your timezone for accurate time parsing and display
- 📱 **Slash Commands**: Modern Discord slash command interface
- 💾 **SQLite Database**: Persistent reminder storage
- 🔄 **Auto-scheduler**: Automatically checks and sends reminders every 30 seconds
- 📋 **Reminder Management**: View, delete, and track your reminders

## Commands

### `/remind <time> <message> [user]`
Create a new reminder
- `time`: When to remind (e.g., "in 2 hours", "tomorrow at 3pm")
- `message`: What to remind about
- `user` (optional): User to remind (defaults to yourself)

### `/reminders [action] [id]`
View and manage your reminders
- `list` (default): Show active reminders
- `completed`: Show completed reminders  
- `delete <id>`: Delete a specific reminder

### `/timezone [timezone]`
Set or view your timezone
- No arguments: View current timezone
- `timezone`: Set new timezone (e.g., "America/New_York", "Europe/London")

### `/help`
Get help with using the bot

## Time Format Examples

- **Relative times:** "in 2 hours", "in 30 minutes", "in 1 day"
- **Specific times:** "tomorrow at 3pm", "next friday at 9am"
- **Dates:** "January 15th at 2pm", "2025-03-20 14:30"
- **Natural language:** "tonight", "this evening", "next week"

## Setup Instructions

### Prerequisites

- Node.js 18+ installed (required for ES modules)
- A Discord application and bot token
- Basic knowledge of Discord bot setup

### 1. Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the **"General Information"** tab and copy the **Application ID**
4. Go to the **"Bot"** section and create a bot
5. Copy the bot **Token** (click "Reset Token" if needed)
6. Enable the following bot permissions:
   - Send Messages
   - Use Slash Commands
   - Read Message History
   - Embed Links

### 2. Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

### 3. Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Discord credentials:
   ```bash
   # From Discord Developer Portal -> Your App -> Bot section
   DISCORD_TOKEN=your_bot_token_here
   
   # From Discord Developer Portal -> Your App -> General Information  
   DISCORD_APPLICATION_ID=your_application_id_here
   
   # Note: Public Key is not needed for this bot (only for slash command verification)
   ```

### 4. Deploy Commands

Deploy the slash commands to Discord:
```bash
npm run deploy
```

### 5. Start the Bot

```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

### 6. Invite Bot to Server

Generate an invite link with the following permissions:
- Applications Commands
- Send Messages
- Embed Links
- Read Message History

## Project Structure

```
src/
├── bot.js              # Main bot file
├── deploy-commands.js  # Command deployment script
├── commands/           # Slash commands
│   ├── remind.js       # Create reminders
│   ├── reminders.js    # Manage reminders
│   ├── timezone.js     # Timezone settings
│   └── help.js         # Help command
├── database/           # Database layer
│   └── database.js     # SQLite database manager
└── utils/              # Utility functions
    ├── timeParser.js   # Time parsing logic
    └── scheduler.js    # Reminder scheduler
```

## Database Schema

The bot uses SQLite with two main tables:

### Users
- `discord_id`: User's Discord ID
- `timezone`: User's preferred timezone
- `created_at`: Account creation timestamp

### Reminders  
- `id`: Unique reminder ID
- `user_id`: Creator's Discord ID
- `target_user_id`: Target user's Discord ID (null for self-reminders)
- `guild_id`: Server ID where reminder was created
- `channel_id`: Channel to send reminder to
- `message`: Reminder message
- `scheduled_time`: When to send reminder (UTC)
- `timezone`: Timezone used for parsing
- `is_completed`: Whether reminder has been sent
- `created_at`: Creation timestamp

## Dependencies

- **discord.js**: Discord API wrapper
- **sqlite3**: SQLite database driver
- **chrono-node**: Natural language date/time parsing
- **moment-timezone**: Timezone handling
- **dotenv**: Environment variable management

## Technical Details

This bot is built using:
- **ES Modules**: Modern JavaScript module system (`import`/`export`)
- **Top-level await**: Async operations at module level
- **SQLite**: Lightweight database for persistence
- **Natural language processing**: Human-friendly time parsing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Legal & Compliance

- **[Terms of Service](TERMS_OF_SERVICE.md)** - User agreement and service terms
- **[Privacy Policy](PRIVACY_POLICY.md)** - Data collection and privacy practices
- **License:** ISC License - feel free to use and modify as needed

These documents are required for Discord bot verification and outline how user data is handled.

## Support

If you encounter any issues:

### Common Setup Issues

1. **"Invalid token" error**: Make sure you copied the Bot Token from the Bot section, not the Public Key
2. **"Unknown application" error**: Verify your Application ID is correct (from General Information tab)
3. **"Used disallowed intents" error**: Your bot token might be invalid, or you need to enable intents in Discord Developer Portal
4. **Commands not appearing**: Run `npm run deploy` to register slash commands with Discord
5. **Permission errors**: Ensure the bot has these permissions in your server:
   - Send Messages
   - Use Slash Commands  
   - Embed Links
   - Read Message History

### ES Module Issues

If you encounter import/export errors:

1. **"does not provide an export named 'default'"**: Some packages don't have default exports in ES modules
2. **"Cannot find module"**: Make sure all local imports have `.js` file extensions
3. **Node.js version**: Ensure you're running Node.js 18+ for full ES module support

### Environment Variables

Make sure your `.env` file contains:
- `DISCORD_TOKEN`: The bot token from Bot section (starts with a long string of characters)
- `DISCORD_APPLICATION_ID`: The application ID from General Information (numeric ID)

### General Troubleshooting

1. Check that all dependencies are installed (`npm install`)
2. Verify Node.js 18+ is installed (`node --version`)
3. Check the console for error messages
4. Ensure the bot is invited to your server with correct permissions