# Discord Reminder Bot

A feature-rich Discord bot for creating and managing reminders with timezone support, message references, and more.

## Features

- ⏰ Natural language time parsing ("in 2 hours", "tomorrow at 3pm")
- 🌍 Timezone support for accurate scheduling
- 🌐 Multi-language support (English, Spanish, Portuguese, Ukrainian)
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

2. Create environment files:

For development:

```bash
cp .env.example .env.development
# Edit .env.development with your Discord credentials
```

For production:

```bash
cp .env.example .env.production
# Edit .env.production with your Discord credentials
```

3. Configure your environment variables:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_APPLICATION_ID=your_application_id_here
DATABASE_PATH=./data/reminders.sqlite  # or /app/data/reminders.sqlite for Docker
NODE_ENV=development  # or production
```

### Environment Configuration

The application expects the following environment variables:

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_APPLICATION_ID=your_application_id
DATABASE_PATH=/path/to/database.sqlite
NODE_ENV=development|production
```

#### Local Development

For local development convenience, create `.env.development` from the template:

```bash
cp .env.example .env.development
# Edit .env.development with your credentials

# Run with npm (loads .env.development automatically)
npm run dev
npm run deploy
```

#### Production Deployment

The application is **cloud-native** and expects environment variables to be set by your deployment platform:

- **AWS ECS/Fargate**: Use task definitions with secrets from AWS Secrets Manager
- **Kubernetes**: Use ConfigMaps and Secrets
- **Heroku/Railway**: Set via dashboard or CLI
- **Docker**: Pass via docker run `-e` flags or compose `environment:`
- **GitHub Actions**: Use repository secrets

**Important:** Production deployments should NOT rely on .env files. Use your platform's native secrets management.

### Running with Docker Compose

#### Production Mode

Start the bot (uses `.env.production`):

```bash
docker-compose up -d
```

Start with secure database viewer:

```bash
# First generate credentials if not already done
./scripts/generate-htpasswd.sh

# Start bot with database viewer
docker-compose --profile debug up -d
```

View logs:

```bash
docker-compose logs -f bot
```

Stop the bot:

```bash
docker-compose down
# Or if running with debug profile:
docker-compose --profile debug down
```

#### Development Mode

Start development environment with hot reload (uses `.env.development`):

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

### Secure Database Viewer

The production database viewer is password-protected for security:

1. Generate authentication credentials:

```bash
./scripts/generate-htpasswd.sh
# Enter username and password when prompted
```

2. Start the secure database viewer:

```bash
docker-compose --profile debug up -d
```

3. Access at http://localhost:8080 with your credentials

**Security Features:**

- Basic HTTP authentication via nginx reverse proxy
- Read-only database access
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- No direct Adminer exposure

To stop the database viewer:

```bash
docker-compose --profile debug down
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

- `/remind time:value message:text [user:@mention]` - Create a reminder for yourself or someone else
- `/remind time:value message_link:url [user:@mention]` - Create a reminder referencing a message
- `/reminders` - View your upcoming reminders
- `/timezone [timezone:value]` - View or change your timezone
- `/language [language:value]` - View or change your preferred language
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

## Internationalization (i18n)

The bot supports multiple languages for all commands and messages:

### Supported Languages

- 🇺🇸 **English** (en-US) - Default
- 🇪🇸 **Español** (es-ES) - Spanish
- 🇧🇷 **Português** (pt-BR) - Portuguese (Brazil)
- 🇺🇦 **Українська** (uk) - Ukrainian

### Language Features

- **Auto-detection**: Automatically uses Discord's interface language
- **Per-user preferences**: Each user can set their preferred language
- **Complete translations**: All commands, error messages, and responses are localized
- **Fallback support**: Falls back to English for any missing translations

### Setting Your Language

1. **View current language**: `/language`
2. **Change language**: `/language language:Español`
3. **Auto-detect**: `/language language:Auto-detect from Discord`

### For Developers

To add a new language:

1. Create a new translation file in `src/i18n/locales/{locale}/translation.json`
2. Copy the English translation as a template
3. Translate all strings to the new language
4. Update the language command choices in `src/commands/language.js`
5. Add locale mapping in `src/context/userPreferences.js`

## Architecture

```
services:
  bot:             # Main Discord bot application
  sqlite-web:      # Optional SQLite web UI (development only)
```

## Cloud Deployment Examples

### AWS ECS with Secrets Manager

```json
{
    "containerDefinitions": [
        {
            "secrets": [
                {
                    "name": "DISCORD_TOKEN",
                    "valueFrom": "arn:aws:secretsmanager:region:account:secret:discord-token"
                }
            ],
            "environment": [
                { "name": "DATABASE_PATH", "value": "/app/data/reminders.sqlite" },
                { "name": "NODE_ENV", "value": "production" }
            ]
        }
    ]
}
```

### Kubernetes with Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
    name: discord-secrets
data:
    DISCORD_TOKEN: <base64-encoded-token>
---
apiVersion: apps/v1
kind: Deployment
spec:
    template:
        spec:
            containers:
                - name: bot
                  envFrom:
                      - secretRef:
                            name: discord-secrets
                  env:
                      - name: DATABASE_PATH
                        value: "/app/data/reminders.sqlite"
```

### Railway/Heroku

Simply set environment variables in the dashboard or CLI - no files needed!

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
