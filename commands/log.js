const {
    SlashCommandBuilder
} = require("discord.js");

// ==========================================
// SETTINGS
// ==========================================

const CHEF_ROLE_ID = "1534681434105712690";

const CHEF_LOG_THREAD =
    "1534966724418342953";

// ==========================================
// ORDER COUNTS
// ==========================================

// Stores the number of completed orders
// for each chef/customer while the bot is online.
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

                // Chef
                .addUserOption(option =>
                    option
                        .setName("chef")
                        .setDescription(
                            "Tag yourself as the chef"
                        )
                        .setRequired(true)
                )

                // Customer
                .addUserOption(option =>
                    option
                        .setName("customer")
                        .setDescription(
                            "Tag the customer"
                        )
                        .setRequired(true)
                )

                // Order
                .addStringOption(option =>
                    option
                        .setName("order")
                        .setDescription(
                            "What was ordered?"
                        )
                        .setRequired(true)
                        .setMaxLength(1000)
                )

                // Total
                .addStringOption(option =>
                    option
                        .setName("total")
                        .setDescription(
                            "Total order price"
                        )
                        .setRequired(true)
                        .setMaxLength(100)
                )
        ),

    async execute(interaction) {

        // ==========================================
        // CHECK SUBCOMMAND
        // ==========================================

        if (
            interaction.options.getSubcommand() !==
            "order"
        ) {
            return;
        }

        // ==========================================
        // GET OPTIONS
        // ==========================================

        const chef =
            interaction.options.getUser("chef");

        const customer =
            interaction.options.getUser("customer");

        const order =
            interaction.options.getString("order");

        const total =
            interaction.options.getString("total");

        // ==========================================
        // CHEF MUST TAG THEMSELVES
        // ==========================================

        if (
            chef.id !== interaction.user.id
        ) {
            return interaction.reply({
                content:
                    "❌ You must tag **yourself** as the chef.",
                ephemeral: true
            });
        }

        // ==========================================
        // CHECK CHEF ROLE
        // ==========================================

        const member =
            await interaction.guild.members.fetch(
                interaction.user.id
            );

        if (
            !member.roles.cache.has(
                CHEF_ROLE_ID
            )
        ) {
            return interaction.reply({
                content:
                    "❌ You must have the **Chef** role to log an order.",
                ephemeral: true
            });
        }

        // ==========================================
        // CUSTOMER CANNOT BE A BOT
        // ==========================================

        if (customer.bot) {
            return interaction.reply({
                content:
                    "❌ The customer must be a real server member.",
                ephemeral: true
            });
        }

        // ==========================================
        // GET CHEF LOG THREAD
        // ==========================================

        let logThread;

        try {

            logThread =
                await interaction.client.channels.fetch(
                    CHEF_LOG_THREAD
                );

        } catch (error) {

            console.error(
                "Could not find Chef Logs thread:",
                error
            );

            return interaction.reply({
                content:
                    "❌ I couldn't find the Chef Logs thread.",
                ephemeral: true
            });
        }

        // ==========================================
        // MAKE SURE IT CAN SEND
        // ==========================================

        if (
            !logThread ||
            !logThread.isThread()
        ) {
            return interaction.reply({
                content:
                    "❌ The Chef Logs channel is not a valid thread.",
                ephemeral: true
            });
        }

        // ==========================================
        // CURRENT COUNTS
        // ==========================================

        const currentChefOrders =
            chefOrderCounts.get(chef.id) || 0;

        const currentCustomerOrders =
            customerOrderCounts.get(customer.id) || 0;

        const newChefOrders =
            currentChefOrders + 1;

        const newCustomerOrders =
            currentCustomerOrders + 1;

        // ==========================================
        // CREATE LOG
        // ==========================================

        const logMessage =
            "# ꒰<:WhiteStar:1534608129042550995> ORDER LOG ꒱\n\n" +

            `꒰👨‍🍳꒱ **Chef:** ${chef}\n` +

            `꒰👤꒱ **Customer:** ${customer}\n` +

            `꒰🍽️꒱ **Order:** ${order}\n` +

            `꒰💰꒱ **Total:** ${total}\n\n` +

            `-# ${chef} has ${newChefOrders} orders\n` +

            `-# This customer (${customer}) has made ${newCustomerOrders} orders`;

        // ==========================================
        // SEND LOG
        // ==========================================

        try {

            await logThread.send({
                content: logMessage
            });

        } catch (error) {

            console.error(
                "Could not send Chef Log:",
                error
            );

            return interaction.reply({
                content:
                    "❌ I couldn't post the order log. No order counts were changed.",
                ephemeral: true
            });
        }

        // ==========================================
        // ONLY COUNT AFTER SUCCESSFUL LOG
        // ==========================================

        chefOrderCounts.set(
            chef.id,
            newChefOrders
        );

        customerOrderCounts.set(
            customer.id,
            newCustomerOrders
        );

        // ==========================================
        // CONFIRMATION
        // ==========================================

        await interaction.reply({
            content:
                "🤍 Order successfully logged!",
            ephemeral: true
        });
    }
};