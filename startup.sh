#!/bin/sh
# Fix permissions for database file if it exists
if [ -f /app/data/reminders.sqlite ]; then
    chmod 664 /app/data/reminders.sqlite
fi

# Start the application
exec nodemon --watch src --ext js,json src/bot.js