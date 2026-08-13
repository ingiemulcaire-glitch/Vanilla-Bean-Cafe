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

    // LOA form submission
    if (interaction.isModalSubmit() && interaction.customId === "loa_modal") {

        const reason = interaction.fields.getTextInputValue("loa_reason");
        const startInput = interaction.fields.getTextInputValue("loa_start");
        const returnInput = interaction.fields.getTextInputValue("loa_return");

        let notes = "None provided";

        try {
            notes = interaction.fields.getTextInputValue("loa_notes");
        } catch {
            // Notes are optional
        }

        const startDate = new Date(startInput);
        const returnDate = new Date(returnInput);

        // Check that the dates are valid
        if (isNaN(startDate.getTime()) || isNaN(returnDate.getTime())) {
            return interaction.reply({
                content: "❌ Please enter valid start and return dates.",
                ephemeral: true
            });
        }

        // Make sure the return date isn't before the start date
        if (returnDate < startDate) {
            return interaction.reply({
                content: "❌ Your return date cannot be before your start date.",
                ephemeral: true
            });
        }

        // Calculate the length of the LOA
        const difference = returnDate - startDate;
        const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

        // Maximum LOA = 14 days
        if (days > 14) {
            return interaction.reply({
                content: "❌ Your LOA can be a maximum of **14 days**.",
                ephemeral: true
            });
        }

        const loaChannel = await client.channels.fetch("1537272589288734850");

if (loaChannel) {
    await loaChannel.send({
        content:
            `📋 **New LOA Request**\n\n` +
            `**Member:** ${interaction.user}\n` +
            `**Reason:** ${reason}\n` +
            `**Start:** ${startInput}\n` +
            `**Return:** ${returnInput}\n` +
            `**Length:** ${days} day(s)\n` +
            `**Notes:** ${notes}`
    });
}

await interaction.reply({
    content: "✅ Your LOA request has been submitted!",
    ephemeral: true
});
    }
});

client.login(process.env.TOKEN);