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
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// ==================================================
// COMMANDS
// ==================================================

const pingCommand = require("./commands/ping.js");
const loaCommand = require("./commands/loa.js");
const logCommand = require("./commands/log.js");

client.commands.set(
    pingCommand.data.name,
    pingCommand
);

client.commands.set(
    loaCommand.data.name,
    loaCommand
);

client.commands.set(
    logCommand.data.name,
    logCommand
);

const commands = [
    pingCommand.data.toJSON(),
    loaCommand.data.toJSON(),
    logCommand.data.toJSON()
];

const rest = new REST({
    version: "10"
}).setToken(process.env.TOKEN);

// ==================================================
// LOA / SERVER IDs
// ==================================================

const LOA_REQUEST_CHANNEL =
    "1537272589288734850";

const ACTIVE_LOA_CHANNEL =
    "1536040816085045289";

const HIGH_RANK_ROLE =
    "1534713555587305533";

const LOA_ROLE =
    "1537663902987587707";

const LOA_ALLOWED_ROLE =
    "1537915689141149696";

// ==================================================
// CHEF LOG IDs
// ==================================================

const CHEF_ROLE_ID =
    "1534681434105712690";

const CHEF_LOG_THREAD_ID =
    "1534966724418342953";

// ==================================================
// PENDING LOAS
// ==================================================

// Keeps people from submitting multiple
// LOA requests while one is awaiting approval.

const pendingLOAs = new Set();

// ==================================================
// ORDER COUNTS
// ==================================================

// These count successfully logged orders
// while the bot is online.

const chefOrderCounts = new Map();
const customerOrderCounts = new Map();

// ==================================================
// DATE PARSER
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

    // ------------------------------------------
    // Month Day Year
    // Example: August 15 2026
    // ------------------------------------------

    let match = value.match(
        /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/
    );

    if (match) {

        const monthName =
            match[1].toLowerCase();

        const monthNumber =
            monthNames[monthName] ??
            shortMonths[monthName];

        if (monthNumber !== undefined) {

            month = monthNumber;
            day = Number(match[2]);
            year = Number(match[3]);

        }
    }

    // ------------------------------------------
    // Day Month Year
    // Example: 15 August 2026
    // ------------------------------------------

    if (
        year === undefined
    ) {

        match = value.match(
            /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/
        );

        if (match) {

            const monthName =
                match[2].toLowerCase();

            const monthNumber =
                monthNames[monthName] ??
                shortMonths[monthName];

            if (monthNumber !== undefined) {

                day = Number(match[1]);
                month = monthNumber;
                year = Number(match[3]);

            }
        }
    }

    // ------------------------------------------
    // Numeric dates
    // Supports:
    // DD/MM/YYYY
    // MM/DD/YYYY
    // DD-MM-YYYY
    // MM-DD-YYYY
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

            // If first > 12, first is definitely the day.
            if (first > 12) {

                day = first;
                month = second - 1;

            }

            // If second > 12, second is definitely the day.
            else if (second > 12) {

                month = first - 1;
                day = second;

            }

            // Ambiguous dates default to MM/DD/YYYY.
            else {

                month = first - 1;
                day = second;

            }
        }
    }

    // ------------------------------------------
    // Validate
    // ------------------------------------------

    if (
        year === undefined ||
        month === undefined ||
        day === undefined
    ) {

        return null;

    }

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
// EMBED FIELD READER
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

            console.log(
                "Registered commands:",
                commands.map(command => command.name)
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
                // Original LOA information
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
                // Find LOA user
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
                // Remove pending status
                // --------------------------------------

                pendingLOAs.delete(userId);

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
                            "❌ I couldn't understand the LOA date.",
                        ephemeral: true
                    });

                }

                // --------------------------------------
                // Calculate LOA length
                // --------------------------------------

                const difference =
                    endDate.getTime() -
                    startDate.getTime();

                const days =
                    Math.round(
                        difference / 86400000
                    );

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
                                color: 0x77DD77,

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

                // --------------------------------------
                // Schedule LOA ending
                // --------------------------------------

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
            // DENY LOA BUTTON
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
            // DENY LOA MODAL
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
                // Remove pending LOA
                // --------------------------------------

                if (userId) {
                    pendingLOAs.delete(userId);
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
                                color: 0xFF6961,

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

                // --------------------------------------
                // Only authorized role can submit LOA
                // --------------------------------------

                if (
                    !interaction.member.roles.cache.has(
                        LOA_ALLOWED_ROLE
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ You do not have permission to submit an LOA.",
                        ephemeral: true
                    });

                }

                // --------------------------------------
                // Already has active LOA
                // --------------------------------------

                if (
                    interaction.member.roles.cache.has(
                        LOA_ROLE
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ You already have an active LOA. You can submit another LOA once your current LOA has finished.",
                        ephemeral: true
                    });

                }

                // --------------------------------------
                // Already has pending LOA
                // --------------------------------------

                if (
                    pendingLOAs.has(
                        interaction.user.id
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ You already have a pending LOA request. Please wait for HR to approve or deny it before submitting another.",
                        ephemeral: true
                    });

                }

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

                } catch {
                    // Optional
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
                            "❌ I couldn't understand one of your dates. Please use a format such as **August 15, 2026** or **15 August 2026**.",
                        ephemeral: true
                    });

                }

                // --------------------------------------
                // Return date check
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
                // Calculate days
                // --------------------------------------

                const difference =
                    returnDate.getTime() -
                    startDate.getTime();

                const days =
                    Math.round(
                        difference / 86400000
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

                // --------------------------------------
                // Find LOA channel
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
                // Mark as pending
                // --------------------------------------

                pendingLOAs.add(
                    interaction.user.id
                );

                // --------------------------------------
                // Send LOA request
                // --------------------------------------

                try {

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

                } catch (error) {

                    pendingLOAs.delete(
                        interaction.user.id
                    );

                    console.error(
                        "Could not send LOA request:",
                        error
                    );

                    return interaction.reply({
                        content:
                            "❌ I couldn't submit your LOA request.",
                        ephemeral: true
                    });

                }

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
// ASPEN / GEM / OWNER TEAM MENTION RESPONSE
// ==================================================

const monitoredUsers = [
    "1311116544838860891", // Aspen
    "1128434621240057998"  // Gem
];

const monitoredRoles = [
    "1534394188333060208",
    "1534394188333060207"
];

client.on(
    "messageCreate",
    async message => {

        if (message.author.bot) {
            return;
        }

        const taggedUser =
            message.mentions.users.find(
                user =>
                    monitoredUsers.includes(
                        user.id
                    )
            );

        const taggedRole =
            message.mentions.roles.find(
                role =>
                    monitoredRoles.includes(
                        role.id
                    )
            );

        if (
            !taggedUser &&
            !taggedRole
        ) {
            return;
        }

        let personText =
            "the Owner Team";

        let timezoneText =
            "";

        // --------------------------------------
        // Aspen
        // --------------------------------------

        if (
            taggedUser &&
            taggedUser.id ===
                "1311116544838860891"
        ) {

            personText =
                "Aspen";

            const now =
                new Date();

            const aspenTime =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        timeZone:
                            "America/Los_Angeles",

                        hour:
                            "numeric",

                        minute:
                            "2-digit",

                        hour12:
                            true,

                        timeZoneName:
                            "short"
                    }
                ).format(now);

            timezoneText =
                `Aspen's local time is currently **${aspenTime}**.`;

        }

        // --------------------------------------
        // Gem
        // --------------------------------------

        else if (
            taggedUser &&
            taggedUser.id ===
                "1128434621240057998"
        ) {

            personText =
                "Gem";

            const now =
                new Date();

            const gemTime =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        timeZone:
                            "America/Chicago",

                        hour:
                            "numeric",

                        minute:
                            "2-digit",

                        hour12:
                            true,

                        timeZoneName:
                            "short"
                    }
                ).format(now);

            timezoneText =
                `Gem's local time is currently **${gemTime}**.`;

        }

        // --------------------------------------
        // Owner Team
        // --------------------------------------

        else if (taggedRole) {

            personText =
                "the Owner Team";

            timezoneText =
                "The Owner Team may currently be offline or busy.";

        }

        // --------------------------------------
        // Response
        // --------------------------------------

        const reply =
            await message.reply({

                content:

                    `🤍 **${personText} may be unavailable right now!**\n\n` +

                    `${timezoneText}\n\n` +

                    `They may currently be offline or busy. If you need something **right away**, please contact a **Staff member** for general assistance or **HR** if your question or concern is staff-related.\n\n` +

                    `Thank you for your patience! ♡`

            });

        // Delete after 10 seconds
        setTimeout(
            () => {

                reply
                    .delete()
                    .catch(() => {});

            },
            10000
        );

    }
);

// ==================================================
// LOGIN
// ==================================================

client.login(
    process.env.TOKEN
);