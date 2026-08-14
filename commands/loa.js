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

const LOA_ROLE_ID = "1537663902987587707";

if (
    interaction.member.roles.cache.has(LOA_ROLE_ID)
) {
    return interaction.reply({
        content:
            "❌ You already have an active LOA. You can submit another LOA once your current LOA has ended.",
        ephemeral: true
    });
}

        const modal = new ModalBuilder()
            .setCustomId("loa_modal")
            .setTitle("Leave of Absence");

        const reason = new TextInputBuilder()
            .setCustomId("loa_reason")
            .setLabel("Reason")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Example: Going to Disney Land")
            .setRequired(true)
            .setMaxLength(500);

        const startDate = new TextInputBuilder()
            .setCustomId("loa_start")
            .setLabel("Start Date")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Example: August 15, 2026")
            .setRequired(true)
            .setMaxLength(50);

        const returnDate = new TextInputBuilder()
            .setCustomId("loa_return")
            .setLabel("Return Date")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Example: August 22, 2026")
            .setRequired(true)
            .setMaxLength(50);

        const notes = new TextInputBuilder()
            .setCustomId("loa_notes")
            .setLabel("Notes (Optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
                "Example: I will complete my orders while on LOA."
            )
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reason),
            new ActionRowBuilder().addComponents(startDate),
            new ActionRowBuilder().addComponents(returnDate),
            new ActionRowBuilder().addComponents(notes)
        );

        await interaction.showModal(modal);
    }
};