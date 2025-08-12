import { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export default {
    data: new ContextMenuCommandBuilder()
        .setName('Remind me about this')
        .setType(ApplicationCommandType.Message),

    async execute(interaction) {
        console.log(`📋 Received message context menu from ${interaction.user.username}#${interaction.user.discriminator}`);
        
        const targetMessage = interaction.targetMessage;
        
        // Create a modal to get the time input
        const modal = new ModalBuilder()
            .setCustomId(`remind_modal_${targetMessage.id}`)
            .setTitle('Create Reminder for Message');

        const timeInput = new TextInputBuilder()
            .setCustomId('reminder_time')
            .setLabel('When should I remind you?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., "in 2 hours", "tomorrow at 3pm"')
            .setRequired(true)
            .setMaxLength(100);

        const messageInput = new TextInputBuilder()
            .setCustomId('reminder_message')
            .setLabel('Reminder message (optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Custom reminder text (leave blank to use original message)')
            .setRequired(false)
            .setMaxLength(500);

        const timeRow = new ActionRowBuilder().addComponents(timeInput);
        const messageRow = new ActionRowBuilder().addComponents(messageInput);

        modal.addComponents(timeRow, messageRow);

        await interaction.showModal(modal);
    }
};