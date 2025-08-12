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
        console.log(`🔄 Processing /remind command...`);
        
        const timeString = interaction.options.getString('time');
        const message = interaction.options.getString('message');
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isRemindingOther = targetUser.id !== interaction.user.id;

        try {
            console.log(`⏰ Parsing time: "${timeString}"`);
            // Parse time with UTC first for quick validation
            const parsedTime = TimeParser.parseTimeString(timeString, 'UTC');
            if (!parsedTime || !parsedTime.isValid) {
                console.log(`❌ Invalid time format detected`);
                const embed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('❌ Invalid Time Format')
                    .setDescription('I couldn\'t understand that time format. Here are some examples:')
                    .addFields(
                        { name: 'Valid formats:', value: TimeParser.getTimeExamples().join('\n') }
                    )
                    .setFooter({ text: 'Tip: Use /timezone to set your timezone for better parsing' });

                console.log(`📤 Sending error response...`);
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            console.log(`✅ Time parsed successfully: ${parsedTime.date}`);
            console.log(`💾 Creating reminder in database...`);

            // Create reminder immediately with default timezone
            const reminderId = await database.createReminder(
                interaction.user.id,
                isRemindingOther ? targetUser.id : null,
                interaction.guild?.id || null,
                interaction.channelId,
                message,
                parsedTime.date.toISOString(),
                'UTC',
                null, // no referenced message
                null  // no referenced message URL
            );

            console.log(`✅ Reminder created with ID: ${reminderId}`);

            // Create users if they don't exist (async, don't wait)
            database.createUser(interaction.user.id).catch(() => {}); // Ignore if exists
            if (isRemindingOther) {
                database.createUser(targetUser.id).catch(() => {}); // Ignore if exists
            }

            const timeFormatted = TimeParser.formatReminderTime(parsedTime.date, 'UTC');

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

            // Reply immediately - no defer needed!
            console.log(`📤 Sending success response...`);
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error creating reminder:', error);
            
            const embed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('Sorry, there was an error creating your reminder. Please try again.');

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            } catch (replyError) {
                console.error('Failed to send error response:', replyError);
            }
        }
    }
};