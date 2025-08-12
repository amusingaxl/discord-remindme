import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import database from '../database/database.js';
import TimeParser from '../utils/timeParser.js';
import moment from 'moment-timezone';

export default {
    data: new SlashCommandBuilder()
        .setName('timezone')
        .setDescription('Set or view your timezone for reminders')
        .addStringOption(option =>
            option.setName('timezone')
                .setDescription('Your timezone (e.g., America/New_York, Europe/London, UTC)')
                .setRequired(false)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const timezones = TimeParser.getSupportedTimezones();
        
        const filtered = timezones.filter(tz => 
            tz.toLowerCase().includes(focusedValue)
        ).slice(0, 25);

        await interaction.respond(
            filtered.map(tz => ({ name: tz, value: tz }))
        );
    },

    async execute(interaction) {
        const newTimezone = interaction.options.getString('timezone');
        
        try {
            // For timezone validation, we can respond quickly
            if (newTimezone && !TimeParser.validateTimezone(newTimezone)) {
                const embed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('❌ Invalid Timezone')
                    .setDescription(`"${newTimezone}" is not a valid timezone.`)
                    .addFields({
                        name: 'Common timezones:',
                        value: TimeParser.getSupportedTimezones().slice(0, 8).join('\n')
                    })
                    .setFooter({ text: 'Use timezone autocomplete or visit: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones' });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Get or create user record quickly
            let userRecord = await database.getUser(interaction.user.id);
            if (!userRecord) {
                await database.createUser(interaction.user.id, newTimezone || 'UTC');
                userRecord = { discord_id: interaction.user.id, timezone: newTimezone || 'UTC' };
            }

            if (!newTimezone) {
                const currentTime = moment().tz(userRecord.timezone).format('YYYY-MM-DD HH:mm:ss z');
                
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🌍 Your Current Timezone')
                    .addFields(
                        { name: 'Timezone', value: userRecord.timezone, inline: true },
                        { name: 'Current Time', value: currentTime, inline: true }
                    )
                    .setDescription('Use `/timezone <timezone>` to change your timezone.')
                    .setFooter({ text: 'Common timezones: UTC, America/New_York, Europe/London, Asia/Tokyo' });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await database.updateUserTimezone(interaction.user.id, newTimezone);
            
            const newTime = moment().tz(newTimezone).format('YYYY-MM-DD HH:mm:ss z');
            
            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('✅ Timezone Updated')
                .addFields(
                    { name: 'New Timezone', value: newTimezone, inline: true },
                    { name: 'Current Time', value: newTime, inline: true }
                )
                .setDescription('Your timezone has been updated! All future reminders will use this timezone for parsing times.');

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error updating timezone:', error);
            
            const embed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('Sorry, there was an error updating your timezone. Please try again.');

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};