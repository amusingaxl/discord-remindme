import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import database from '../database/database.js';
import TimeParser from '../utils/timeParser.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Create a reminder for yourself or someone else')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('When to remind (e.g., "in 2 hours", "tomorrow at 3pm")')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('What to remind about')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to remind (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const timeString = interaction.options.getString('time');
        const message = interaction.options.getString('message');
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isRemindingOther = targetUser.id !== interaction.user.id;

        try {
            // First, validate the time format quickly to give immediate feedback
            const quickTimeCheck = TimeParser.parseTimeString(timeString, 'UTC');
            if (!quickTimeCheck || !quickTimeCheck.isValid) {
                const embed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('❌ Invalid Time Format')
                    .setDescription('I couldn\'t understand that time format. Here are some examples:')
                    .addFields(
                        { name: 'Valid formats:', value: TimeParser.getTimeExamples().join('\n') }
                    )
                    .setFooter({ text: 'Tip: Use /timezone to set your timezone for better parsing' });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Now defer for the longer database operations
            await interaction.deferReply();
            let userRecord = await database.getUser(interaction.user.id);
            if (!userRecord) {
                await database.createUser(interaction.user.id);
                userRecord = { discord_id: interaction.user.id, timezone: 'UTC' };
            }

            if (isRemindingOther) {
                let targetUserRecord = await database.getUser(targetUser.id);
                if (!targetUserRecord) {
                    await database.createUser(targetUser.id);
                }
            }

            // Parse time with user's timezone (we already validated it's parseable)
            const parsedTime = TimeParser.parseTimeString(timeString, userRecord.timezone);

            const reminderId = await database.createReminder(
                interaction.user.id,
                isRemindingOther ? targetUser.id : null,
                interaction.guild?.id || null,
                interaction.channelId,
                message,
                parsedTime.date.toISOString(),
                parsedTime.originalTimezone
            );

            const timeFormatted = TimeParser.formatReminderTime(parsedTime.date, userRecord.timezone);

            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('✅ Reminder Created')
                .setDescription(`I'll remind ${isRemindingOther ? `<@${targetUser.id}>` : 'you'} about: **${message}**`)
                .addFields(
                    { name: '⏰ When', value: `${timeFormatted.relative}\n(<t:${timeFormatted.timestamp}:F>)`, inline: true },
                    { name: '🆔 ID', value: `${reminderId}`, inline: true }
                )
                .setFooter({ text: `Use /reminders to view all your reminders` });

            if (isRemindingOther) {
                embed.addFields({
                    name: '👤 Target',
                    value: `<@${targetUser.id}>`,
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error creating reminder:', error);
            
            const embed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('Sorry, there was an error creating your reminder. Please try again.');

            await interaction.editReply({ embeds: [embed] });
        }
    }
};