const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loa")
        .setDescription("Submit a leave of absence"),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("loa_modal")
            .setTitle("Leave of Absence");

        const reason = new TextInputBuilder()
            .setCustomId("loa_reason")
            .setLabel("Reason")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Why are you going on LOA?")
            .setRequired(true);

        const startDate = new TextInputBuilder()
            .setCustomId("loa_start")
            .setLabel("Start Date")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Example: August 15, 2026")
            .setRequired(true);

        const returnDate = new TextInputBuilder()
            .setCustomId("loa_return")
            .setLabel("Return Date")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Example: August 22, 2026")
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reason),
            new ActionRowBuilder().addComponents(startDate),
            new ActionRowBuilder().addComponents(returnDate)
        );

        await interaction.showModal(modal);
    }
};