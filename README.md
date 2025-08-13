# Discord Reminder Bot

A feature-rich Discord bot for creating and managing reminders with timezone support, message references, and more.

## Features

- ⏰ Natural language time parsing ("in 2 hours", "tomorrow at 3pm")
- 🌍 Timezone support for accurate scheduling
- 💬 Reply-based reminders with message context
- 🔗 Message link references for slash commands
- 👥 Remind yourself or other users
- 📱 Works in DMs and server channels
- 🔄 Persistent storage with SQLite

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed
- Discord bot token and application ID

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/remindme-discord.git
cd remindme-discord
```

2. Create `.env` file from example:

```bash
cp .env.example .env
```

3. Edit `.env` and add your Discord credentials:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_APPLICATION_ID=your_application_id_here
```

### Running with Docker Compose

#### Production Mode

Start the bot:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f bot
```

Stop the bot:

```bash
docker-compose down
```

#### Development Mode

Start development environment with hot reload:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Access SQLite web interface at: http://localhost:8081

Stop development environment:

```bash
docker-compose -f docker-compose.dev.yml down
```

### Docker Commands

Deploy slash commands to Discord:

```bash
docker-compose exec bot node src/deploy-commands.js
```

Enter bot container shell:

```bash
docker-compose exec bot sh
```

Backup database:

```bash
docker cp discord-reminder-bot:/app/data/reminders.sqlite ./backups/reminders_$(date +%Y%m%d_%H%M%S).sqlite
```

## Local Development (without Docker)

### Prerequisites

- Node.js LTS (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file and add your Discord credentials

3. Deploy slash commands:

```bash
npm run deploy
```

4. Start the bot:

```bash
npm start
```

## Usage

### Slash Commands

- `/remind time:value message:text` - Create a reminder
- `/remind time:value message_link:url` - Create a reminder referencing a message
- `/reminders` - View your upcoming reminders
- `/timezone set:value` - Set your timezone
- `/help` - Show help information

### Message Commands

- `!remind "in 2 hours" Buy groceries` - Self reminder
- `!remind @user "tomorrow at 3pm" Meeting` - Remind another user
- Reply to a message with `!remind "in 1 hour"` - Reminder with message context

### Time Formats

- Relative: "in 30 minutes", "in 2 hours", "in 3 days"
- Specific: "tomorrow at 3pm", "next Friday at 9am"
- Natural: "tonight", "this evening", "next week"
- Absolute: "January 15th at 2pm", "2025-03-20 14:30"

## Architecture

```
services:
  bot:             # Main Discord bot application
  database-backup: # Automated SQLite backup service
  database-viewer: # Optional web UI for database (debug profile)
```

## Environment Variables

| Variable                 | Description             | Default                      |
| ------------------------ | ----------------------- | ---------------------------- |
| `DISCORD_TOKEN`          | Discord bot token       | Required                     |
| `DISCORD_APPLICATION_ID` | Discord application ID  | Required                     |
| `DATABASE_PATH`          | Path to SQLite database | `/app/data/reminders.sqlite` |
| `DEFAULT_TIMEZONE`       | Default timezone        | `UTC`                        |
| `NODE_ENV`               | Environment mode        | `production`                 |

## License

MIT
