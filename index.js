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
// Helper: Parse MM/DD/YYYY
// ================================

function parseDateOnly(dateString) {
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

    // Use UTC so BotHosting's timezone doesn't affect date calculations
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

// ================================
// Helper: Discord timestamp
// ================================

function discordTimestamp(date) {
    return Math.floor(
        date.getTime() / 1000
    );
}


// ================================
// Bot Ready
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
// Interactions
// ================================

client.on(
    "interactionCreate",
    async interaction => {

        // ================================
        // Slash Commands
        // ================================

        if (interaction.isChatInputCommand()) {

            const command =
                client.commands.get(
                    interaction.commandName
                );

            if (!command) return;

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

            const embed =
                interaction.message.embeds[0];

            const description =
                embed?.description || "";

            // Get original LOA information

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


            // Get member who submitted LOA

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


            // Exact time HR approves

            const approvalTime =
                new Date();


            // Get requested end date

            const endDateOnly =
                parseDateOnly(endDate);

            if (!endDateOnly) {
                return interaction.reply({
                    content:
                        "❌ I couldn't understand the LOA end date.",
                    ephemeral: true
                });
            }


            // Calculate the number of days
            // between the requested dates

            const startDateOnly =
                parseDateOnly(startDate);

            if (!startDateOnly) {
                return interaction.reply({
                    content:
                        "❌ I couldn't understand the LOA start date.",
                    ephemeral: true
                });
            }

            const loaDays =
                Math.round(
                    (
                        endDateOnly.getTime() -
                        startDateOnly.getTime()
                    ) /
                    (1000 * 60 * 60 * 24)
                );


            // End time = approval time
            // + requested number of days

            const endTime =
                new Date(
                    approvalTime.getTime() +
                    (
                        loaDays *
                        24 *
                        60 *
                        60 *
                        1000
                    )
                );


            const startTimestamp =
                discordTimestamp(
                    approvalTime
                );

            const endTimestamp =
                discordTimestamp(
                    endTime
                );


            // ================================
            // Find member
            // ================================

            let member = null;

            if (userId) {
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
            }


            // ================================
            // Add LOA role
            // ================================

            if (member) {

                try {

                    await member.roles.add(
                        LOA_ROLE,
                        "LOA approved"
                    );

                    console.log(
                        `LOA role added to ${member.user.tag}`
                    );

                } catch (error) {

                    console.error(
                        "Could not add LOA role:",
                        error
                    );
                }
            }


            // ================================
            // Send approved LOA
            // ================================

            const activeLoaChannel =
                await client.channels.fetch(
                    ACTIVE_LOA_CHANNEL
                );

            if (activeLoaChannel) {

                await activeLoaChannel.send({

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
            // Update original request
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
            // Schedule LOA completion
            // ================================

            const delay =
                endTime.getTime() -
                Date.now();

            if (delay > 0) {

                setTimeout(
                    async () => {

                        try {

                            const guild =
                                interaction.guild;

                            const loaMember =
                                await guild.members.fetch(
                                    userId
                                );

                            if (loaMember) {

                                await loaMember.roles.remove(
                                    LOA_ROLE,
                                    "LOA ended"
                                );
                            }


                            // Send completion message

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
        // DENY LOA BUTTON
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


            modal.addComponents(row);

            await interaction.showModal(
                modal
            );

            return;
        }


        // ================================
        // DENY LOA SUBMISSION
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


            // Get original message ID

            const messageId =
                interaction.customId.replace(
                    "loa_deny_modal_",
                    ""
                );


            // Get LOA request channel

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


            const loaMessage =
                await loaChannel.messages.fetch(
                    messageId
                );


            if (!loaMessage) {
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


            // Get member

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


            // Send denied LOA

            const activeLoaChannel =
                await client.channels.fetch(
                    ACTIVE_LOA_CHANNEL
                );


            if (activeLoaChannel) {

                await activeLoaChannel.send({

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
                parseDateOnly(
                    startInput
                );

            const returnDate =
                parseDateOnly(
                    returnInput
                );


            // Validate dates

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


            // Return date cannot be before start

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


            // Calculate LOA length

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


            // ================================
            // Send LOA request
            // ================================

            const loaChannel =
                await client.channels.fetch(
                    LOA_REQUEST_CHANNEL
                );


            if (loaChannel) {

                await loaChannel.send({

                    // Ping member + High Ranks

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

                    // Buttons

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
            }


            // Confirmation

            await interaction.reply({

                content:
                    "🤍 your LOA request has been submitted!",

                ephemeral: true
            });

            return;
        }
    }
});


// ================================
// Login
// ================================

client.login(
    process.env.TOKEN
);