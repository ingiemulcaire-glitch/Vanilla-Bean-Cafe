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
    if (!interaction.isChatInputCommand()) return;

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
});

client.login(process.env.TOKEN);