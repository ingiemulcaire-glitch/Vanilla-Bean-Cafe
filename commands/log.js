const { SlashCommandBuilder } = require("discord.js");

const CHEF_ROLE_ID = "1534681434105712690";
const CHEF_LOG_THREAD_ID = "1534966724418342953";

const chefOrderCounts = new Map();
const customerOrderCounts = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("log")
        .setDescription("Log server activity")

        .addSubcommand(subcommand =>
            subcommand
                .setName("order")
                .setDescription("Log a completed order")

                .addUserOption(option =>
                    option
                        .setName("chef")
                        .setDescription("Tag yourself as the chef")
                        .setRequired(true)
                )

                .addUserOption(option =>
                    option
                        .setName("customer")
                        .setDescription("Tag the customer")
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName("order")
                        .setDescription("What was ordered?")
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName("total")
                        .setDescription("Total price")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {

        if (
            interaction.options.getSubcommand() !== "order"
        ) {
            return;
        }

        const chef =
            interaction.options.getUser("chef");

        const customer =
            interaction.options.getUser("customer");

        const order =
            interaction.options.getString("order");

        const total =
            interaction.options.getString("total");

        // Chef must tag themselves
        if (chef.id !== interaction.user.id) {
            return interaction.reply({
                content:
                    "❌ You must tag yourself as the chef.",
                ephemeral: true
            });
        }

        // Chef role check
        if (
            !interaction.member.roles.cache.has(
                CHEF_ROLE_ID
            )
        ) {
            return interaction.reply({
                content:
                    "❌ You must have the Chef role to log an order.",
                ephemeral: true
            });
        }

        // Customer cannot be a bot
        if (customer.bot) {
            return interaction.reply({
                content:
                    "❌ The customer must be a real server member.",
                ephemeral: true
            });
        }

        // Find Chef Logs thread
        let chefLogThread;

        try {
            chefLogThread =
                await interaction.client.channels.fetch(
                    CHEF_LOG_THREAD_ID
                );
        } catch (error) {
            console.error(error);

            return interaction.reply({
                content:
                    "❌ I couldn't find the Chef Logs thread.",
                ephemeral: true
            });
        }

        // Make sure it is actually a thread
        if (
            !chefLogThread ||
            !chefLogThread.isThread()
        ) {
            return interaction.reply({
                content:
                    "❌ The Chef Logs channel isn't a valid thread.",
                ephemeral: true
            });
        }

        // Current counts
        const chefCount =
            chefOrderCounts.get(chef.id) || 0;

        const customerCount =
            customerOrderCounts.get(customer.id) || 0;

        const newChefCount =
            chefCount + 1;

        const newCustomerCount =
            customerCount + 1;

        // Create the log
        const logMessage =
            "# ꒰<:WhiteStar:1534608129042550995> ORDER LOG ꒱\n\n" +

            `꒰👨‍🍳꒱ **Chef:** ${chef}\n` +

            `꒰👤꒱ **Customer:** ${customer}\n` +

            `꒰🍽️꒱ **Order:** ${order}\n` +

            `꒰💰꒱ **Total:** ${total}\n\n` +

            `-# ${chef} has ${newChefCount} orders\n` +

            `-# This customer (${customer}) has made ${newCustomerCount} orders`;

        // Send log
        try {
            await chefLogThread.send({
                content: logMessage
            });
        } catch (error) {
            console.error(error);

            return interaction.reply({
                content:
                    "❌ I couldn't send the order log. No counts were changed.",
                ephemeral: true
            });
        }

        // Only count after successful log
        chefOrderCounts.set(
            chef.id,
            newChefCount
        );

        customerOrderCounts.set(
            customer.id,
            newCustomerCount
        );

        await interaction.reply({
            content:
                "🤍 Order successfully logged!",
            ephemeral: true
        });
    }
};