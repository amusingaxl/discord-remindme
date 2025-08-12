import database from '../database/database.js';
import { EmbedBuilder } from 'discord.js';
import TimeParser from './timeParser.js';

class ReminderScheduler {
    constructor(client) {
        this.client = client;
        this.checkInterval = null;
    }

    start() {
        console.log('🕐 Reminder scheduler started');
        this.checkInterval = setInterval(() => {
            this.checkReminders();
        }, 30000); // Check every 30 seconds
        
        this.checkReminders();
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('⏹️ Reminder scheduler stopped');
        }
    }

    async checkReminders() {
        try {
            const activeReminders = await database.getActiveReminders();
            console.log(`🔍 Checking reminders... Found ${activeReminders.length} due reminders`);
            
            if (activeReminders.length > 0) {
                console.log('Due reminders:', activeReminders.map(r => `ID:${r.id} Time:${r.scheduled_time}`));
            }
            
            for (const reminder of activeReminders) {
                await this.processReminder(reminder);
            }
            
        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    }

    async processReminder(reminder) {
        try {
            console.log(`📨 Processing reminder ${reminder.id}: "${reminder.message}"`);
            const channel = await this.client.channels.fetch(reminder.channel_id);
            if (!channel) {
                console.error(`Channel ${reminder.channel_id} not found for reminder ${reminder.id}`);
                await database.completeReminder(reminder.id);
                return;
            }

            const targetUserId = reminder.target_user_id || reminder.user_id;
            const creatorUserId = reminder.user_id;
            const isForSomeoneElse = targetUserId !== creatorUserId;

            let embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⏰ Reminder')
                .setDescription(`**${reminder.message}**`)
                .setTimestamp(new Date(reminder.created_at));

            if (isForSomeoneElse) {
                embed.addFields({
                    name: '👤 From',
                    value: `<@${creatorUserId}>`,
                    inline: true
                });
            }

            // Add link to original message if available
            if (reminder.referenced_message_url) {
                embed.addFields({
                    name: '🔗 Original Message',
                    value: `[Jump to message](${reminder.referenced_message_url})`,
                    inline: true
                });
            }

            const content = `🔔 Hey <@${targetUserId}>! You asked me to remind you about this.`;

            console.log(`💬 Sending reminder to channel ${channel.name} (${channel.id})`);
            await channel.send({ 
                content: content,
                embeds: [embed] 
            });

            await database.completeReminder(reminder.id);
            console.log(`✅ Reminder ${reminder.id} completed and sent to ${targetUserId}`);

        } catch (error) {
            console.error(`Error processing reminder ${reminder.id}:`, error);
            
            if (error.code === 10003) { 
                console.log(`Channel not found for reminder ${reminder.id}, marking as completed`);
                await database.completeReminder(reminder.id);
            } else if (error.code === 50013) { 
                console.log(`No permissions to send reminder ${reminder.id}, marking as completed`);
                await database.completeReminder(reminder.id);
            } else if (error.code === 50001) {
                console.log(`Missing access to channel for reminder ${reminder.id}, marking as completed`);
                await database.completeReminder(reminder.id);
            }
        }
    }

    async getUpcomingReminders(limit = 10) {
        try {
            const reminders = await database.db.all(`
                SELECT r.*, u.timezone 
                FROM reminders r 
                LEFT JOIN users u ON r.user_id = u.discord_id 
                WHERE r.is_completed = FALSE 
                AND r.scheduled_time > datetime('now')
                ORDER BY r.scheduled_time ASC 
                LIMIT ?
            `, [limit]);

            return reminders.map(reminder => ({
                ...reminder,
                formatted_time: TimeParser.formatReminderTime(
                    new Date(reminder.scheduled_time), 
                    reminder.timezone || 'UTC'
                )
            }));
        } catch (error) {
            console.error('Error getting upcoming reminders:', error);
            return [];
        }
    }
}

export default ReminderScheduler;