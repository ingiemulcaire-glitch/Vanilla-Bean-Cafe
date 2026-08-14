const {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes
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

client.once("ready", async () => {
    console.log(`${client.user.tag} is online!`);

    try {
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log("Slash commands registered!");
    } catch (error) {
        console.error("Could not register commands:", error);
    }
});

client.on("interactionCreate", async interaction => {

    // Slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "Something went wrong!",
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: "Something went wrong!",
                    ephemeral: true
                });
            }
        }

        return;
    }

// LOA Accept button
if (
    interaction.isButton() &&
    interaction.customId === "loa_accept"
) {
    const hrRoleId = "1534713555587305533";
    const loaRoleId = "1537663902987587707";

    // Only High Ranks can approve LOAs
    if (!interaction.member.roles.cache.has(hrRoleId)) {
        return interaction.reply({
            content: "❌ You do not have permission to approve LOAs.",
            ephemeral: true
        });
    }

    const embed = interaction.message.embeds[0];
    const description = embed.description || "";

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
        )?.[1] || "None provided";

    // Get the user who submitted the LOA
    const userMatch =
        interaction.message.content.match(
            /<@!?(\d+)>/
        );

    const userId =
        userMatch ? userMatch[1] : null;

    const userMention =
        userId
            ? `<@${userId}>`
            : "Unknown User";

    // The exact moment HR approves the LOA
    const approvalTime = new Date();

    // Convert MM/DD/YYYY into a reliable date
const parts = endDate.split("/");

const requestedEndDate = new Date(
    parts[2],
    parts[0] - 1,
    parts[1],
    approvalTime.getHours(),
    approvalTime.getMinutes(),
    approvalTime.getSeconds()
);

    // Discord timestamps
    const startTimestamp =
        Math.floor(
            approvalTime.getTime() / 1000
        );

    const endTimestamp =
        Math.floor(
            requestedEndDate.getTime() / 1000
        );

    // Find the member
    let member = null;

    if (userId) {
        try {
            member =
                await interaction.guild.members.fetch(
                    userId
                );
        } catch {
            console.log(
                "Could not fetch LOA member."
            );
        }
    }

    // Add LOA role
    if (member) {
        try {
            await member.roles.add(
                loaRoleId,
                "LOA approved"
            );
        } catch (error) {
            console.error(
                "Could not add LOA role:",
                error
            );
        }
    }

    // Send approved LOA to Active LOAs
    const activeLoaChannel =
        await client.channels.fetch(
            "1536040816085045289"
        );

    if (activeLoaChannel) {
        await activeLoaChannel.send({
            content: userMention,

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

    // Mark original request as approved
    await interaction.update({
        content: interaction.message.content,

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
}
    
    // Update the original LOA request
    await interaction.update({
        content: interaction.message.content,
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
}

// LOA Deny button
if (
    interaction.isButton() &&
    interaction.customId === "loa_deny"
) {
    const hrRoleId = "1534713555587305533";

    if (!interaction.member.roles.cache.has(hrRoleId)) {
        return interaction.reply({
            content: "❌ You do not have permission to deny LOAs.",
            ephemeral: true
        });
    }

    const {
        ModalBuilder,
        TextInputBuilder,
        TextInputStyle,
        ActionRowBuilder
    } = require("discord.js");

    const modal = new ModalBuilder()
        .setCustomId(`loa_deny_modal_${interaction.message.id}`)
        .setTitle("Deny LOA");

    const reasonInput = new TextInputBuilder()
        .setCustomId("deny_reason")
        .setLabel("Reason for denial")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explain why this LOA is being denied...")
        .setRequired(true)
        .setMaxLength(500);

    const row = new ActionRowBuilder()
        .addComponents(reasonInput);

    modal.addComponents(row);

    await interaction.showModal(modal);
}

// LOA denial submission
if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith("loa_deny_modal_")
) {
    const hrRoleId = "1534713555587305533";

    if (!interaction.member.roles.cache.has(hrRoleId)) {
        return interaction.reply({
            content: "❌ You do not have permission to deny LOAs.",
            ephemeral: true
        });
    }

    const denialReason =
        interaction.fields.getTextInputValue("deny_reason");

    const messageId =
        interaction.customId.replace("loa_deny_modal_", "");

    const loaChannel =
        await client.channels.fetch("1537272589288734850");

    if (!loaChannel) {
        return interaction.reply({
            content: "❌ I couldn't find the LOA channel.",
            ephemeral: true
        });
    }

    const loaMessage =
        await loaChannel.messages.fetch(messageId);

    if (!loaMessage) {
        return interaction.reply({
            content: "❌ I couldn't find the original LOA request.",
            ephemeral: true
        });
    }

    const description =
        loaMessage.embeds[0]?.description || "";

    const startDate =
        description.match(/Start Date:\*\* (.+)/)?.[1] ||
        "Unknown";

    const endDate =
        description.match(/End Date:\*\* (.+)/)?.[1] ||
        "Unknown";

    const reason =
        description.match(/Reason:\*\* (.+)/)?.[1] ||
        "Unknown";

    const notes =
        description.match(/Notes:\*\* (.+)/)?.[1] ||
        "None provided";

    const userMatch =
        loaMessage.content.match(/<@!?(\d+)>/);

    const userId =
        userMatch ? userMatch[1] : null;

    const userMention =
        userId ? `<@${userId}>` : "Unknown User";

    // Send denied LOA to the active LOA channel
    const activeLoaChannel =
        await client.channels.fetch(
            "1536040816085045289"
        );

    if (activeLoaChannel) {
        await activeLoaChannel.send({
            content: userMention,
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
        content: "❌ LOA has been denied.",
        ephemeral: true
    });
}

    // LOA form submission
    if (
        interaction.isModalSubmit() &&
        interaction.customId === "loa_modal"
    ) {
        const reason =
            interaction.fields.getTextInputValue("loa_reason");

        const startInput =
            interaction.fields.getTextInputValue("loa_start");

        const returnInput =
            interaction.fields.getTextInputValue("loa_return");

        let notes = "None provided";

        try {
            notes =
                interaction.fields.getTextInputValue("loa_notes");
        } catch {
            // Notes are optional
        }

        const startDate = new Date(startInput);
        const returnDate = new Date(returnInput);

        // Check that the dates are valid
        if (
            isNaN(startDate.getTime()) ||
            isNaN(returnDate.getTime())
        ) {
            return interaction.reply({
                content:
                    "❌ Please enter valid start and return dates.",
                ephemeral: true
            });
        }

        // Return date cannot be before start date
        if (returnDate < startDate) {
            return interaction.reply({
                content:
                    "❌ Your return date cannot be before your start date.",
                ephemeral: true
            });
        }

        // Calculate LOA length
        const difference = returnDate - startDate;

        const days = Math.ceil(
            difference / (1000 * 60 * 60 * 24)
        );

        // Minimum of 3 days
        if (days < 3) {
            return interaction.reply({
                content:
                    "❌ Your LOA must be at least **3 days**.",
                ephemeral: true
            });
        }

        // Maximum of 14 days
        if (days > 14) {
            return interaction.reply({
                content:
                    "❌ Your LOA can be a maximum of **14 days**.",
                ephemeral: true
            });
        }

        // LOA channel
        const loaChannel =
            await client.channels.fetch(
                "1537272589288734850"
            );

        if (loaChannel) {
            await loaChannel.send({
                // Ping the member and High Ranks
                content:
                    `${interaction.user} <@&1534713555587305533>`,

                // LOA embed
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

                // Accept / Deny buttons
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

        // Private confirmation
        await interaction.reply({
            content:
                "🤍 your LOA request has been submitted!",
            ephemeral: true
        });
    }
});

client.login(process.env.TOKEN);