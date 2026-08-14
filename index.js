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


// ==================================================
// IDs
// ==================================================

const LOA_REQUEST_CHANNEL =
    "1537272589288734850";

const ACTIVE_LOA_CHANNEL =
    "1536040816085045289";

const HIGH_RANK_ROLE =
    "1534713555587305533";

const LOA_ROLE =
    "1537663902987587707";


// ==================================================
// DATE PARSER
// Accepts multiple date formats
// ==================================================

function parseUserDate(input) {

    if (!input) {
        return null;
    }

    const value = input
        .trim()
        .replace(/,/g, "")
        .replace(/\s+/g, " ");

    let day;
    let month;
    let year;

    // ------------------------------------------
    // Month name formats
    // August 15 2026
    // 15 August 2026
    // Aug 15 2026
    // 15 Aug 2026
    // ------------------------------------------

    const monthNames = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11
    };

    const shortMonths = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        sept: 8,
        oct: 9,
        nov: 10,
        dec: 11
    };

    let match = value.match(
        /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/
    );

    if (match) {

        const monthName =
            match[1].toLowerCase();

        const monthNumber =
            monthNames[monthName] ??
            shortMonths[monthName];

        if (
            monthNumber !== undefined
        ) {
            month = monthNumber;
            day = Number(match[2]);
            year = Number(match[3]);
        }
    }

    if (!month && month !== 0) {

        match = value.match(
            /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/
        );

        if (match) {

            const monthName =
                match[2].toLowerCase();

            const monthNumber =
                monthNames[monthName] ??
                shortMonths[monthName];

            if (
                monthNumber !== undefined
            ) {
                day = Number(match[1]);
                month = monthNumber;
                year = Number(match[3]);
            }
        }
    }


    // ------------------------------------------
    // Numeric dates
    // ------------------------------------------

    if (
        year === undefined
    ) {

        match = value.match(
            /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/
        );

        if (match) {

            const first =
                Number(match[1]);

            const second =
                Number(match[2]);

            year =
                Number(match[3]);


            /*
             * If one number is greater than 12,
             * we know that number is the day.
             *
             * Example:
             * 15/08/2026 = 15 August
             */

            if (first > 12) {

                day = first;
                month = second - 1;

            } else if (second > 12) {

                month = first - 1;
                day = second;

            } else {

                /*
                 * Ambiguous dates default to
                 * month/day/year.
                 *
                 * For example:
                 * 08/15/2026 = August 15
                 *
                 * If both are 12 or below,
                 * written month names are recommended.
                 */

                month = first - 1;
                day = second;

            }
        }
    }


    // ------------------------------------------
    // Make sure everything exists
    // ------------------------------------------

    if (
        year === undefined ||
        month === undefined ||
        day === undefined
    ) {
        return null;
    }


    // ------------------------------------------
    // Validate date
    // ------------------------------------------

    const date =
        new Date(
            year,
            month,
            day,
            12,
            0,
            0,
            0
        );


    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }


    return date;
}


// ==================================================
// DISCORD TIMESTAMP
// ==================================================

function discordTimestamp(date) {

    return Math.floor(
        date.getTime() / 1000
    );

}


// ==================================================
// EXTRACT EMBED FIELD
// ==================================================

function getEmbedField(
    description,
    fieldName,
    fallback
) {

    const regex =
        new RegExp(
            `${fieldName}:\\*\\* (.+)`
        );

    const match =
        description.match(regex);

    return match
        ? match[1]
        : fallback;
}


// ==================================================
// BOT READY
// ==================================================

client.once(
    "ready",
    async () => {

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

    }
);


// ==================================================
// INTERACTION HANDLER
// ==================================================

client.on(
    "interactionCreate",
    async interaction => {

        try {


            // ==========================================
            // SLASH COMMANDS
            // ==========================================

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

                await command.execute(
                    interaction
                );

                return;
            }


            // ==========================================
            // ACCEPT LOA
            // ==========================================

            if (
                interaction.isButton() &&
                interaction.customId === "loa_accept"
            ) {

                // --------------------------------------
                // High Rank permission
                // --------------------------------------

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


                // --------------------------------------
                // Get original information
                // --------------------------------------

                const startDateText =
                    getEmbedField(
                        description,
                        "Start Date",
                        "Unknown"
                    );

                const endDateText =
                    getEmbedField(
                        description,
                        "End Date",
                        "Unknown"
                    );

                const reason =
                    getEmbedField(
                        description,
                        "Reason",
                        "Unknown"
                    );

                const notes =
                    getEmbedField(
                        description,
                        "Notes",
                        "None provided"
                    );


                // --------------------------------------
                // Find user
                // --------------------------------------

                const userMatch =
                    interaction.message.content.match(
                        /<@!?(\d+)/
                    );

                const userId =
                    userMatch
                        ? userMatch[1]
                        : null;


                if (!userId) {

                    return interaction.reply({
                        content:
                            "❌ I couldn't identify the member who submitted this LOA.",
                        ephemeral: true
                    });

                }


                const userMention =
                    `<@${userId}>`;


                // --------------------------------------
                // Parse dates
                // --------------------------------------

                const startDate =
                    parseUserDate(
                        startDateText
                    );

                const endDate =
                    parseUserDate(
                        endDateText
                    );


                if (
                    !startDate ||
                    !endDate
                ) {

                    return interaction.reply({
                        content:
                            "❌ I couldn't understand the LOA date. Please use a format such as **August 15, 2026**.",
                        ephemeral: true
                    });

                }


                // --------------------------------------
                // Calculate LOA length
                // --------------------------------------

                const millisecondsPerDay =
                    24 * 60 * 60 * 1000;

                const days =
                    Math.round(
                        (
                            endDate.getTime() -
                            startDate.getTime()
                        ) /
                        millisecondsPerDay
                    );


                // --------------------------------------
                // 3–14 day limit
                // --------------------------------------

                if (days < 3) {

                    return interaction.reply({
                        content:
                            "❌ This LOA is less than the required **3-day minimum**.",
                        ephemeral: true
                    });

                }


                if (days > 14) {

                    return interaction.reply({
                        content:
                            "❌ This LOA exceeds the **14-day maximum**.",
                        ephemeral: true
                    });

                }


                // --------------------------------------
                // Discord timestamps
                // --------------------------------------

                const startTimestamp =
                    discordTimestamp(
                        startDate
                    );

                const endTimestamp =
                    discordTimestamp(
                        endDate
                    );


                // --------------------------------------
                // Fetch member
                // --------------------------------------

                let member = null;

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


                // --------------------------------------
                // Add LOA role
                // --------------------------------------

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


                // --------------------------------------
                // Active LOA channel
                // --------------------------------------

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


                // --------------------------------------
                // Update original request
                // --------------------------------------

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


                /*
                 * IMPORTANT:
                 *
                 * The role removal is scheduled from
                 * the requested end date.
                 *
                 * If the bot restarts before that time,
                 * Node's setTimeout will be lost.
                 *
                 * The approval itself still works.
                 */

                const timeUntilEnd =
                    endDate.getTime() -
                    Date.now();


                if (
                    timeUntilEnd > 0 &&
                    timeUntilEnd <= 2147483647
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


                                if (
                                    completionChannel
                                ) {

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
                                    "Error ending LOA:",
                                    error
                                );

                            }

                        },
                        timeUntilEnd
                    );

                }

                return;
            }


            // ==========================================
            // DENY BUTTON
            // ==========================================

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


            // ==========================================
            // DENY MODAL
            // ==========================================

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
                            "❌ I couldn't find the LOA request channel.",
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
                    loaMessage.embeds[0]
                        ?.description || "";


                const startDate =
                    getEmbedField(
                        description,
                        "Start Date",
                        "Unknown"
                    );

                const endDate =
                    getEmbedField(
                        description,
                        "End Date",
                        "Unknown"
                    );

                const reason =
                    getEmbedField(
                        description,
                        "Reason",
                        "Unknown"
                    );

                const notes =
                    getEmbedField(
                        description,
                        "Notes",
                        "None provided"
                    );


                const userMatch =
                    loaMessage.content.match(
                        /<@!?(\d+)/
                    );


                const userId =
                    userMatch
                        ? userMatch[1]
                        : null;


                const userMention =
                    userId
                        ? `<@${userId}>`
                        : "Unknown User";


                // --------------------------------------
                // Send denied message
                // --------------------------------------

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


                // --------------------------------------
                // Update original request
                // --------------------------------------

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


            // ==========================================
            // LOA FORM SUBMISSION
            // ==========================================

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
                        interaction.fields.getTextInputValue(
                            "loa_notes"
                        ).trim() ||
                        "None provided";

                } catch (error) {

                    // Notes are optional

                }


                // --------------------------------------
                // Parse dates
                // --------------------------------------

                const startDate =
                    parseUserDate(
                        startInput
                    );

                const returnDate =
                    parseUserDate(
                        returnInput
                    );


                if (
                    !startDate ||
                    !returnDate
                ) {

                    return interaction.reply({

                        content:
                            "❌ I couldn't understand one of your dates. Please use a format such as **August 15, 2026**.",

                        ephemeral: true

                    });

                }


                // --------------------------------------
                // Check date order
                // --------------------------------------

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


                // --------------------------------------
                // Calculate LOA length
                // --------------------------------------

                const difference =
                    returnDate.getTime() -
                    startDate.getTime();


                const days =
                    Math.round(
                        difference / 86400000
                    );


                // --------------------------------------
                // Minimum 3 days
                // --------------------------------------

                if (days < 3) {

                    return interaction.reply({

                        content:
                            "❌ Your LOA must be at least **3 days**.",

                        ephemeral: true

                    });

                }


                // --------------------------------------
                // Maximum 14 days
                // --------------------------------------

                if (days > 14) {

                    return interaction.reply({

                        content:
                            "❌ Your LOA can be a maximum of **14 days**.",

                        ephemeral: true

                    });

                }


                // --------------------------------------
                // Fetch LOA channel
                // --------------------------------------

                const loaChannel =
                    await client.channels.fetch(
                        LOA_REQUEST_CHANNEL
                    );


                if (!loaChannel) {

                    return interaction.reply({

                        content:
                            "❌ I couldn't find the LOA request channel.",

                        ephemeral: true

                    });

                }


                // --------------------------------------
                // Send request
                // --------------------------------------

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


// ==================================================
// LOGIN
// ==================================================

client.login(
    process.env.TOKEN
);