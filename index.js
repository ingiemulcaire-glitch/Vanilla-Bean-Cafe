const {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

client.commands = new Collection();

const pingCommand = require("./commands/ping.js");
const loaCommand = require("./commands/loa.js");

client.commands.set(
    pingCommand.data.name,
    pingCommand
);

client.commands.set(
    loaCommand.data.name,
    loaCommand
);

const commands = [
    pingCommand.data.toJSON(),
    loaCommand.data.toJSON()
];

const rest = new REST({
    version: "10"
}).setToken(process.env.TOKEN);


// ==========================================
// IDs
// ==========================================

const LOA_REQUEST_CHANNEL = "1537272589288734850";
const ACTIVE_LOA_CHANNEL = "1536040816085045289";
const HIGH_RANK_ROLE = "1534713555587305533";
const LOA_ROLE = "1537663902987587707";


// ==========================================
// DATE HELPER
// MM/DD/YYYY
// ==========================================

function parseDate(dateString) {

    const parts = dateString.split("/");

    if (parts.length !== 3) {
        return null;
    }

    const month = Number(parts[0]);
    const day = Number(parts[1]);
    const year = Number(parts[2]);

    if (
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        !Number.isInteger(year)
    ) {
        return null;
    }

    if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    ) {
        return null;
    }

    const date = new Date(
        Date.UTC(
            year,
            month - 1,
            day
        )
    );

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
}


// ==========================================
// DISCORD TIMESTAMP
// ==========================================

function timestamp(date) {

    return Math.floor(
        date.getTime() / 1000
    );

}


// ==========================================
// BOT READY
// ==========================================

client.once("ready", async () => {

    console.log(
        `${client.user.tag} is online!`
    );

    try {

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            {
                body: commands
            }
        );

        console.log(
            "Slash commands registered!"
        );

    } catch (error) {

        console.error(
            "Could not register commands:",
            error
        );

    }

});


// ==========================================
// INTERACTIONS
// ==========================================

client.on(
    "interactionCreate",
    async interaction => {


        // ======================================
        // SLASH COMMANDS
        // ======================================

        if (
            interaction.isChatInputCommand()
        ) {

            const command =
                client.commands.get(
                    interaction.commandName
                );

            if (!command) {
                return;
            }

            try {

                await command.execute(
                    interaction
                );

            } catch (error) {

                console.error(error);

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp({
                        content:
                            "Something went wrong!",
                        ephemeral: true
                    });

                } else {

                    await interaction.reply({
                        content:
                            "Something went wrong!",
                        ephemeral: true
                    });

                }

            }

            return;
        }


        // ======================================
        // ACCEPT LOA
        // ======================================

        if (
            interaction.isButton() &&
            interaction.customId === "loa_accept"
        ) {

            if (
                !interaction.member.roles.cache.has(
                    HIGH_RANK_ROLE
                )
            ) {

                return interaction.reply({
                    content:
                        "❌ You do not have permission to approve LOAs.",
                    ephemeral: true
                });

            }


            const embed =
                interaction.message.embeds[0];

            const description =
                embed?.description || "";


            // Get LOA information

            const startDate =
                description.match(
                    /Start Date:\*\* (.+)/
                )?.[1] || "Unknown";

            const endDate =
                description.match(
                    /End Date:\*\* (.+)/
                )?.[1] || "Unknown";

            const reason =
                description.match(
                    /Reason:\*\* (.+)/
                )?.[1] || "Unknown";

            const notes =
                description.match(
                    /Notes:\*\* (.+)/
                )?.[1] ||
                "None provided";


            // Get user

            const userMatch =
                interaction.message.content.match(
                    /<@!?(\d+)>/
                );

            const userId =
                userMatch
                    ? userMatch[1]
                    : null;

            const userMention =
                userId
                    ? `<@${userId}>`
                    : "Unknown User";


            if (!userId) {

                return interaction.reply({
                    content:
                        "❌ I couldn't identify the LOA member.",
                    ephemeral: true
                });

            }


            // Approval time

            const approvalTime =
                new Date();


            // Parse dates

            const startDateOnly =
                parseDate(startDate);

            const endDateOnly =
                parseDate(endDate);


            if (
                !startDateOnly ||
                !endDateOnly
            ) {

                return interaction.reply({
                    content:
                        "❌ The LOA dates are invalid. Please use MM/DD/YYYY.",
                    ephemeral: true
                });

            }


            // Calculate LOA length

            const days =
                Math.round(
                    (
                        endDateOnly.getTime() -
                        startDateOnly.getTime()
                    ) /
                    (1000 * 60 * 60 * 24)
                );


            // End time = approval time + LOA length

            const endTime =
                new Date(
                    approvalTime.getTime() +
                    (
                        days *
                        24 *
                        60 *
                        60 *
                        1000
                    )
                );


            const startTimestamp =
                timestamp(
                    approvalTime
                );

            const endTimestamp =
                timestamp(
                    endTime
                );


            // ==================================
            // GET MEMBER
            // ==================================

            let member = null;

            try {

                member =
                    await interaction.guild.members.fetch(
                        userId
                    );

            } catch (error) {

                console.error(
                    "Could not fetch member:",
                    error
                );

            }


            // ==================================
            // ADD LOA ROLE
            // ==================================

            if (member) {

                try {

                    await member.roles.add(
                        LOA_ROLE,
                        "LOA approved"
                    );

                } catch (error) {

                    console.error(
                        "Could not add LOA role:",
                        error
                    );

                }

            }


            // ==================================
            // ACTIVE LOA CHANNEL
            // ==================================

            const activeChannel =
                await client.channels.fetch(
                    ACTIVE_LOA_CHANNEL
                );


            if (activeChannel) {

                await activeChannel.send({

                    content:
                        userMention,

                    embeds: [
                        {
                            color: 0xEDE3D3,

                            description:

                                "# ꒰<:WhiteStar:1534608129042550995>  LOA APPROVED ꒱\n" +

                                "-# Your LOA has been successfully submitted and approved.\n\n" +

                                `꒰<:emojigg_1:1534654332090187897>: **Start Date:** <t:${startTimestamp}:F>\n` +

                                `꒰<:emojigg_2:1534654486310555668>: **End Date:** <t:${endTimestamp}:F>\n` +

                                `꒰<:emojigg_3:1534654794285715466>: **Reason:** ${reason}\n` +

                                `꒰<:emojigg_4:1534654854750933012>: **Approved By:** ${interaction.user}\n\n` +

                                `꒰<:WhiteStar:1534608129042550995>꒱ **Ping User:** ${userMention}\n` +

                                `꒰📝꒱ **Notes:** ${notes}`
                        }
                    ]

                });

            }


            // ==================================
            // UPDATE ORIGINAL REQUEST
            // ==================================

            await interaction.update({

                content:
                    interaction.message.content,

                embeds: [
                    {
                        color: 0xEDE3D3,

                        description:
                            description +
                            `\n\n<:WhiteStar:1534608129042550995> **LOA APPROVED**\nApproved by: ${interaction.user}`
                    }
                ],

                components: []

            });


            // ==================================
            // AUTOMATIC LOA END
            // ==================================

            const delay =
                endTime.getTime() -
                Date.now();


            if (delay > 0) {

                setTimeout(
                    async () => {

                        try {

                            const loaMember =
                                await interaction.guild.members.fetch(
                                    userId
                                );


                            if (loaMember) {

                                await loaMember.roles.remove(
                                    LOA_ROLE,
                                    "LOA ended"
                                );

                            }


                            const completionChannel =
                                await client.channels.fetch(
                                    ACTIVE_LOA_CHANNEL
                                );


                            if (completionChannel) {

                                await completionChannel.send({

                                    content:
                                        userMention,

                                    embeds: [
                                        {
                                            color: 0xEDE3D3,

                                            description:

                                                "# ꒰<:WhiteStar:1534608129042550995>  LOA COMPLETED ꒱\n" +

                                                "-# Your LOA has officially ended!\n\n" +

                                                `꒰<:WhiteStar:1534608129042550995>꒱ **Member:** ${userMention}\n` +

                                                `꒰📅꒱ **Ended:** <t:${endTimestamp}:F>`
                                        }
                                    ]

                                });

                            }

                        } catch (error) {

                            console.error(
                                "Error completing LOA:",
                                error
                            );

                        }

                    },
                    delay
                );

            }

            return;
        }


        // ======================================
        // DENY BUTTON
        // ======================================

        if (
            interaction.isButton() &&
            interaction.customId === "loa_deny"
        ) {

            if (
                !interaction.member.roles.cache.has(
                    HIGH_RANK_ROLE
                )
            ) {

                return interaction.reply({
                    content:
                        "❌ You do not have permission to deny LOAs.",
                    ephemeral: true
                });

            }


            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `loa_deny_modal_${interaction.message.id}`
                    )
                    .setTitle(
                        "Deny LOA"
                    );


            const reasonInput =
                new TextInputBuilder()
                    .setCustomId(
                        "deny_reason"
                    )
                    .setLabel(
                        "Reason for denial"
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setPlaceholder(
                        "Explain why this LOA is being denied..."
                    )
                    .setRequired(true)
                    .setMaxLength(500);


            const row =
                new ActionRowBuilder()
                    .addComponents(
                        reasonInput
                    );


            modal.addComponents(
                row
            );


            await interaction.showModal(
                modal
            );

            return;
        }


        // ======================================
        // DENY MODAL
        // ======================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId.startsWith(
                "loa_deny_modal_"
            )
        ) {

            if (
                !interaction.member.roles.cache.has(
                    HIGH_RANK_ROLE
                )
            ) {

                return interaction.reply({
                    content:
                        "❌ You do not have permission to deny LOAs.",
                    ephemeral: true
                });

            }


            const denialReason =
                interaction.fields.getTextInputValue(
                    "deny_reason"
                );


            const messageId =
                interaction.customId.replace(
                    "loa_deny_modal_",
                    ""
                );


            const loaChannel =
                await client.channels.fetch(
                    LOA_REQUEST_CHANNEL
                );


            if (!loaChannel) {

                return interaction.reply({
                    content:
                        "❌ I couldn't find the LOA channel.",
                    ephemeral: true
                });

            }


            let loaMessage;

            try {

                loaMessage =
                    await loaChannel.messages.fetch(
                        messageId
                    );

            } catch (error) {

                return interaction.reply({
                    content:
                        "❌ I couldn't find the original LOA request.",
                    ephemeral: true
                });

            }


            const description =
                loaMessage.embeds[0]?.description ||
                "";


            const startDate =
                description.match(
                    /Start Date:\*\* (.+)/
                )?.[1] ||
                "Unknown";

            const endDate =
                description.match(
                    /End Date:\*\* (.+)/
                )?.[1] ||
                "Unknown";

            const reason =
                description.match(
                    /Reason:\*\* (.+)/
                )?.[1] ||
                "Unknown";

            const notes =
                description.match(
                    /Notes:\*\* (.+)/
                )?.[1] ||
                "None provided";


            const userMatch =
                loaMessage.content.match(
                    /<@!?(\d+)>/
                );

            const userId =
                userMatch
                    ? userMatch[1]
                    : null;

            const userMention =
                userId
                    ? `<@${userId}>`
                    : "Unknown User";


            // Send denied message

            const activeChannel =
                await client.channels.fetch(
                    ACTIVE_LOA_CHANNEL
                );


            if (activeChannel) {

                await activeChannel.send({

                    content:
                        userMention,

                    embeds: [
                        {
                            color: 0xEDE3D3,

                            description:

                                "# ꒰<:WhiteStar:1534608129042550995>  LOA DENIED ꒱\n" +

                                "-# Your LOA request has been denied.\n\n" +

                                `꒰<:emojigg_1:1534654332090187897>: **Start Date:** ${startDate}\n` +

                                `꒰<:emojigg_2:1534654486310555668>: **End Date:** ${endDate}\n` +

                                `꒰<:emojigg_3:1534654794285715466>: **Reason:** ${reason}\n` +

                                `꒰<:emojigg_4:1534654854750933012>: **Denied By:** ${interaction.user}\n\n` +

                                `꒰❌꒱ **Denial Reason:** ${denialReason}\n` +

                                `꒰<:WhiteStar:1534608129042550995>꒱ **Ping User:** ${userMention}\n` +

                                `꒰📝꒱ **Notes:** ${notes}`
                        }
                    ]

                });

            }


            // Update original request

            await loaMessage.edit({

                embeds: [
                    {
                        color: 0xEDE3D3,

                        description:
                            description +
                            `\n\n<:WhiteStar:1534608129042550995> **LOA DENIED**\nDenied by: ${interaction.user}\nReason: ${denialReason}`
                    }
                ],

                components: []

            });


            await interaction.reply({

                content:
                    "❌ LOA has been denied.",

                ephemeral: true

            });

            return;
        }


        // ======================================
        // LOA FORM
        // ======================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId === "loa_modal"
        ) {

            const reason =
                interaction.fields.getTextInputValue(
                    "loa_reason"
                );

            const startInput =
                interaction.fields.getTextInputValue(
                    "loa_start"
                );

            const returnInput =
                interaction.fields.getTextInputValue(
                    "loa_return"
                );


            let notes =
                "None provided";


            try {

                notes =
                    interaction.fields.getTextInputValue(
                        "loa_notes"
                    );

            } catch {

                // Notes are optional

            }


            // Parse dates

            const startDate =
                parseDate(startInput);

            const returnDate =
                parseDate(returnInput);


            if (
                !startDate ||
                !returnDate
            ) {

                return interaction.reply({

                    content:
                        "❌ Please enter dates in **MM/DD/YYYY** format.",

                    ephemeral: true

                });

            }


            // Check order

            if (
                returnDate.getTime() <
                startDate.getTime()
            ) {

                return interaction.reply({

                    content:
                        "❌ Your return date cannot be before your start date.",

                    ephemeral: true

                });

            }


            // Calculate length

            const difference =
                returnDate.getTime() -
                startDate.getTime();

            const days =
                Math.round(
                    difference /
                    (1000 * 60 * 60 * 24)
                );


            // Minimum 3 days

            if (days < 3) {

                return interaction.reply({

                    content:
                        "❌ Your LOA must be at least **3 days**.",

                    ephemeral: true

                });

            }


            // Maximum 14 days

            if (days > 14) {

                return interaction.reply({

                    content:
                        "❌ Your LOA can be a maximum of **14 days**.",

                    ephemeral: true

                });

            }


            // ==================================
            // SEND LOA REQUEST
            // ==================================

            const loaChannel =
                await client.channels.fetch(
                    LOA_REQUEST_CHANNEL
                );


            if (!loaChannel) {

                return interaction.reply({

                    content:
                        "❌ I couldn't find the LOA channel.",

                    ephemeral: true

                });

            }


            await loaChannel.send({

                content:
                    `${interaction.user} <@&${HIGH_RANK_ROLE}>`,

                embeds: [
                    {
                        color: 0xEDE3D3,

                        description:

                            "# ꒰<:WhiteStar:1534608129042550995>  LOA REQUEST ꒱\n\n" +

                            `꒰<:emojigg_1:1534654332090187897>: **Start Date:** ${startInput}\n` +

                            `꒰<:emojigg_2:1534654486310555668>: **End Date:** ${returnInput}\n` +

                            `꒰<:emojigg_3:1534654794285715466>: **Reason:** ${reason}\n` +

                            `꒰<:emojigg_4:1534654854750933012>: **Length:** ${days} day(s)\n` +

                            `꒰<:emojigg_5:1534654998653435905>: **Notes:** ${notes}`
                    }
                ],

                components: [
                    {
                        type: 1,

                        components: [

                            {
                                type: 2,
                                style: 3,
                                label: "Accept LOA",
                                custom_id: "loa_accept",

                                emoji: {
                                    name: "WhiteStar",
                                    id: "1534608129042550995"
                                }
                            },

                            {
                                type: 2,
                                style: 4,
                                label: "Deny LOA",
                                custom_id: "loa_deny",

                                emoji: {
                                    name: "WhiteStar",
                                    id: "1534608129042550995"
                                }
                            }

                        ]
                    }
                ]

            });


            await interaction.reply({

                content:
                    "🤍 your LOA request has been submitted!",

                ephemeral: true

            });

            return;
        }

    }
});


// ==========================================
// LOGIN
// ==========================================

client.login(
    process.env.TOKEN
);