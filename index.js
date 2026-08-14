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
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

const pingCommand = require("./commands/ping.js");
const loaCommand = require("./commands/loa.js");

client.commands.set(pingCommand.data.name, pingCommand);
client.commands.set(loaCommand.data.name, loaCommand);

const commands = [
    pingCommand.data.toJSON(),
    loaCommand.data.toJSON()
];

const rest = new REST({ version: "10" })
    .setToken(process.env.TOKEN);


// ================================
// IDs
// ================================

const LOA_REQUEST_CHANNEL = "1537272589288734850";
const ACTIVE_LOA_CHANNEL = "1536040816085045289";
const HIGH_RANK_ROLE = "1534713555587305533";
const LOA_ROLE = "1537663902987587707";


// ================================
// MM/DD/YYYY DATE PARSER
// ================================

function parseDate(value) {
    const match = /^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/.exec(
        value.trim()
    );

    if (!match) return null;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(
        year,
        month - 1,
        day
    );

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}


// ================================
// DISCORD TIMESTAMP
// ================================

function discordTime(date) {
    return Math.floor(date.getTime() / 1000);
}


// ================================
// GET EMBED FIELD
// ================================

function getField(description, field, fallback) {
    const match = description.match(
        new RegExp(`${field}:\\*\\* (.+)`)
    );

    return match ? match[1] : fallback;
}


// ================================
// READY
// ================================

client.once("ready", async () => {
    console.log(`${client.user.tag} is online!`);

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

        console.log("Slash commands registered!");
    } catch (error) {
        console.error(
            "Could not register commands:",
            error
        );
    }
});


// ================================
// INTERACTIONS
// ================================

client.on(
    "interactionCreate",
    async interaction => {

        try {

            // ================================
            // SLASH COMMANDS
            // ================================

            if (interaction.isChatInputCommand()) {

                const command =
                    client.commands.get(
                        interaction.commandName
                    );

                if (!command) return;

                await command.execute(
                    interaction
                );

                return;
            }


            // ================================
            // ACCEPT LOA
            // ================================

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


                const description =
                    interaction.message.embeds[0]
                        ?.description || "";


                const startDateText =
                    getField(
                        description,
                        "Start Date",
                        "Unknown"
                    );

                const endDateText =
                    getField(
                        description,
                        "End Date",
                        "Unknown"
                    );

                const reason =
                    getField(
                        description,
                        "Reason",
                        "Unknown"
                    );

                const notes =
                    getField(
                        description,
                        "Notes",
                        "None provided"
                    );


                // Find member who requested LOA

                const userMatch =
                    interaction.message.content.match(
                        /<@!?(\d+)>/
                    );

                const userId =
                    userMatch
                        ? userMatch[1]
                        : null;


                if (!userId) {
                    return interaction.reply({
                        content:
                            "❌ I couldn't identify the LOA member.",
                        ephemeral: true
                    });
                }


                const userMention =
                    `<@${userId}>`;


                // ================================
                // APPROVAL TIME
                // ================================

                const approvalTime =
                    new Date();


                // ================================
                // PARSE DATES
                // ================================

                const requestedStart =
                    parseDate(
                        startDateText
                    );

                const requestedEnd =
                    parseDate(
                        endDateText
                    );


                if (
                    !requestedStart ||
                    !requestedEnd
                ) {
                    return interaction.reply({
                        content:
                            "❌ The LOA dates are invalid. Please use MM/DD/YYYY.",
                        ephemeral: true
                    });
                }


                // ================================
                // LOA LENGTH
                // ================================

                const days =
                    Math.round(
                        (
                            requestedEnd -
                            requestedStart
                        ) / 86400000
                    );


                if (
                    days < 3 ||
                    days > 14
                ) {
                    return interaction.reply({
                        content:
                            "❌ This LOA is outside the 3–14 day limit.",
                        ephemeral: true
                    });
                }


                // ================================
                // END TIME
                // ================================

                const endTime =
                    new Date(
                        approvalTime.getTime() +
                        days * 86400000
                    );


                const startTimestamp =
                    discordTime(
                        approvalTime
                    );

                const endTimestamp =
                    discordTime(
                        endTime
                    );


                // ================================
                // GET MEMBER
                // ================================

                let member;

                try {

                    member =
                        await interaction.guild.members.fetch(
                            userId
                        );

                } catch (error) {

                    console.error(
                        "Could not fetch LOA member:",
                        error
                    );

                }


                // ================================
                // ADD LOA ROLE
                // ================================

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


                // ================================
                // ACTIVE LOA CHANNEL
                // ================================

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


                // ================================
                // UPDATE ORIGINAL REQUEST
                // ================================

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


                // ================================
                // AUTOMATIC LOA COMPLETION
                // ================================

                const delay =
                    endTime.getTime() -
                    Date.now();


                if (
                    delay > 0 &&
                    delay <= 2147483647
                ) {

                    setTimeout(
                        async () => {

                            try {

                                const loaMember =
                                    await interaction.guild.members.fetch(
                                        userId
                                    );


                                await loaMember.roles.remove(
                                    LOA_ROLE,
                                    "LOA ended"
                                );


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


            // ================================
            // DENY BUTTON
            // ================================

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


                const input =
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
                        .setRequired(true)
                        .setMaxLength(500);


                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            input
                        );


                modal.addComponents(
                    row
                );


                await interaction.showModal(
                    modal
                );

                return;
            }


            // ================================
            // DENY MODAL
            // ================================

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


                const loaMessage =
                    await loaChannel.messages.fetch(
                        messageId
                    );


                const description =
                    loaMessage.embeds[0]
                        ?.description || "";


                const startDate =
                    getField(
                        description,
                        "Start Date",
                        "Unknown"
                    );

                const endDate =
                    getField(
                        description,
                        "End Date",
                        "Unknown"
                    );

                const reason =
                    getField(
                        description,
                        "Reason",
                        "Unknown"
                    );

                const notes =
                    getField(
                        description,
                        "Notes",
                        "None provided"
                    );


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


            // ================================
            // LOA FORM SUBMISSION
            // ================================

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
                    ).trim();


                const returnInput =
                    interaction.fields.getTextInputValue(
                        "loa_return"
                    ).trim();


                let notes =
                    "None provided";


                try {

                    notes =
                        interaction.fields
                            .getTextInputValue(
                                "loa_notes"
                            )
                            .trim() ||
                        "None provided";

                } catch (error) {
                    // Notes are optional
                }


                const startDate =
                    parseDate(
                        startInput
                    );

                const returnDate =
                    parseDate(
                        returnInput
                    );


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


                if (
                    returnDate < startDate
                ) {

                    return interaction.reply({

                        content:
                            "❌ Your return date cannot be before your start date.",

                        ephemeral: true

                    });

                }


                const days =
                    Math.round(
                        (
                            returnDate -
                            startDate
                        ) / 86400000
                    );


                if (days < 3) {

                    return interaction.reply({

                        content:
                            "❌ Your LOA must be at least **3 days**.",

                        ephemeral: true

                    });

                }


                if (days > 14) {

                    return interaction.reply({

                        content:
                            "❌ Your LOA can be a maximum of **14 days**.",

                        ephemeral: true

                    });

                }


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

        } catch (error) {

            console.error(
                "Interaction error:",
                error
            );


            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({

                    content:
                        "❌ Something went wrong while processing this request.",

                    ephemeral: true

                }).catch(() => {});

            }

        }

    }
);


// ================================
// LOGIN
// ================================

client.login(
    process.env.TOKEN
);