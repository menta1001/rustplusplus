/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

const Builder = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');

const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const MarketUtils = require('../util/marketUtils.js');

module.exports = {
    name: 'market',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('market')
            .setDescription(client.intlGet(guildId, 'commandsMarketDesc'))
            .addSubcommand(subcommand => subcommand
                .setName('search')
                .setDescription(client.intlGet(guildId, 'commandsMarketSearchDesc'))
                .addStringOption(option => option
                    .setName('order')
                    .setDescription(client.intlGet(guildId, 'commandsMarketOrderDesc'))
                    .setRequired(true)
                    .addChoices(
                        { name: client.intlGet(guildId, 'all'), value: 'all' },
                        { name: client.intlGet(guildId, 'buy'), value: 'buy' },
                        { name: client.intlGet(guildId, 'sell'), value: 'sell' }))
                .addStringOption(option => option
                    .setName('name')
                    .setDescription(client.intlGet(guildId, 'theNameOfTheItem'))
                    .setRequired(false))
                .addStringOption(option => option
                    .setName('id')
                    .setDescription(client.intlGet(guildId, 'theIdOfTheItem'))
                    .setRequired(false)))
            .addSubcommand(subcommand => subcommand
                .setName('subscribe')
                .setDescription(client.intlGet(guildId, 'commandsMarketSubscribeDesc'))
                .addStringOption(option => option
                    .setName('order')
                    .setDescription(client.intlGet(guildId, 'commandsMarketOrderDesc'))
                    .setRequired(true)
                    .addChoices(
                        { name: client.intlGet(guildId, 'all'), value: 'all' },
                        { name: client.intlGet(guildId, 'buy'), value: 'buy' },
                        { name: client.intlGet(guildId, 'sell'), value: 'sell' }))
                .addStringOption(option => option
                    .setName('name')
                    .setDescription(client.intlGet(guildId, 'theNameOfTheItem'))
                    .setRequired(false))
                .addStringOption(option => option
                    .setName('id')
                    .setDescription(client.intlGet(guildId, 'theIdOfTheItem'))
                    .setRequired(false)))
            .addSubcommand(subcommand => subcommand
                .setName('unsubscribe')
                .setDescription(client.intlGet(guildId, 'commandsMarketUnsubscribeDesc'))
                .addStringOption(option => option
                    .setName('order')
                    .setDescription(client.intlGet(guildId, 'commandsMarketOrderDesc'))
                    .setRequired(true)
                    .addChoices(
                        { name: client.intlGet(guildId, 'all'), value: 'all' },
                        { name: client.intlGet(guildId, 'buy'), value: 'buy' },
                        { name: client.intlGet(guildId, 'sell'), value: 'sell' }))
                .addStringOption(option => option
                    .setName('name')
                    .setDescription(client.intlGet(guildId, 'theNameOfTheItem'))
                    .setRequired(false))
                .addStringOption(option => option
                    .setName('id')
                    .setDescription(client.intlGet(guildId, 'theIdOfTheItem'))
                    .setRequired(false)))
            .addSubcommand(subcommand => subcommand
                .setName('list')
                .setDescription(client.intlGet(guildId, 'commandsMarketListDesc')));
    },

    async execute(client, interaction) {
        const instance = client.getInstance(interaction.guildId);
        const rustplus = client.rustplusInstances[interaction.guildId];

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!rustplus || (rustplus && !rustplus.isOperational)) {
            const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        switch (interaction.options.getSubcommand()) {
            case 'search': {
                const searchItemName = interaction.options.getString('name');
                const searchItemId = interaction.options.getString('id');
                const orderType = interaction.options.getString('order');

                const resolution = MarketUtils.getItemIdsFromInput(client, interaction.guildId,
                    searchItemName, searchItemId);

                if (resolution.errorKey) {
                    const str = client.intlGet(interaction.guildId, resolution.errorKey, resolution.errorArgs || {});
                    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                    rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str);
                    return;
                }

                const itemIds = resolution.itemIds;
                const itemNames = itemIds.map(id => client.items.getName(id) || id);

                const lines = MarketUtils.collectMatchingOrders(rustplus, client,
                    interaction.guildId, itemIds, orderType);
                let description = MarketUtils.formatDiffLines(lines);

                if (description === null) {
                    description = client.intlGet(interaction.guildId, 'noItemFound');
                }

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
                    id: `${verifyId}`,
                    value: `search, ${searchItemName}, ${searchItemId}, ${orderType}`
                }));

                const embed = DiscordEmbeds.getEmbed({
                    color: Constants.COLOR_DEFAULT,
                    title: client.intlGet(interaction.guildId, 'searchResult', {
                        name: itemNames.join(', ')
                    }),
                    description: description,
                    footer: { text: `${instance.serverList[rustplus.serverId].title}` }
                });

                await client.interactionEditReply(interaction, { embeds: [embed] });
                rustplus.log(client.intlGet(interaction.guildId, 'infoCap'),
                    client.intlGet(interaction.guildId, 'searchResult', { name: itemNames.join(', ') }));
            } break;

            case 'subscribe': {
                const subscribeItemName = interaction.options.getString('name');
                const subscribeItemId = interaction.options.getString('id');
                const orderType = interaction.options.getString('order');

                const resolution = MarketUtils.getItemIdsFromInput(client, interaction.guildId,
                    subscribeItemName, subscribeItemId);

                if (resolution.errorKey) {
                    const str = client.intlGet(interaction.guildId, resolution.errorKey, resolution.errorArgs || {});
                    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                    rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str);
                    return;
                }

                const addedNames = [];
                const alreadyNames = [];
                const serverTitle = instance.serverList[rustplus.serverId].title;

                for (const itemId of resolution.itemIds) {
                    if (instance.marketSubscriptionList[orderType].includes(itemId)) {
                        alreadyNames.push(client.items.getName(itemId) || itemId);
                        continue;
                    }

                    instance.marketSubscriptionList[orderType].push(itemId);
                    rustplus.firstPollItems[orderType].push(itemId);
                    addedNames.push(client.items.getName(itemId) || itemId);
                }

                client.setInstance(interaction.guildId, instance);

                await DiscordMessages.sendMarketListingsMessage(interaction.guildId, rustplus.serverId);
                rustplus.lastMarketListingsUpdate = Date.now();

                let response = '';
                if (addedNames.length > 0) {
                    response += client.intlGet(interaction.guildId, 'justSubscribedToItem', {
                        name: addedNames.join(', ')
                    });
                }

                if (alreadyNames.length > 0) {
                    const alreadyStr = client.intlGet(interaction.guildId, 'alreadySubscribedToItem', {
                        name: alreadyNames.join(', ')
                    });
                    response += response === '' ? alreadyStr : `\n${alreadyStr}`;
                }

                const embedType = addedNames.length > 0 ? 0 : 1;

                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(embedType, response,
                    serverTitle));

                rustplus.log(client.intlGet(interaction.guildId, addedNames.length > 0 ? 'infoCap' : 'warningCap'),
                    response);

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
                    id: `${verifyId}`,
                    value: `unsubscribe, ${subscribeItemName}, ${subscribeItemId}, ${orderType}`
                }));
            } break;

            case 'unsubscribe': {
                const subscribeItemName = interaction.options.getString('name');
                const subscribeItemId = interaction.options.getString('id');
                const orderType = interaction.options.getString('order');

                const resolution = MarketUtils.getItemIdsFromInput(client, interaction.guildId,
                    subscribeItemName, subscribeItemId);

                if (resolution.errorKey) {
                    const str = client.intlGet(interaction.guildId, resolution.errorKey, resolution.errorArgs || {});
                    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                    rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str);
                    return;
                }

                const removedNames = [];
                const missingNames = [];
                const serverTitle = instance.serverList[rustplus.serverId].title;

                for (const itemId of resolution.itemIds) {
                    if (instance.marketSubscriptionList[orderType].includes(itemId)) {
                        instance.marketSubscriptionList[orderType] =
                            instance.marketSubscriptionList[orderType].filter(e => e !== itemId);
                        removedNames.push(client.items.getName(itemId) || itemId);
                    }
                    else {
                        missingNames.push(client.items.getName(itemId) || itemId);
                    }
                }

                client.setInstance(interaction.guildId, instance);

                await DiscordMessages.sendMarketListingsMessage(interaction.guildId, rustplus.serverId);
                rustplus.lastMarketListingsUpdate = Date.now();

                let response = '';
                if (removedNames.length > 0) {
                    response += client.intlGet(interaction.guildId, 'removedSubscribeItem', {
                        name: removedNames.join(', ')
                    });
                }

                if (missingNames.length > 0) {
                    const missingStr = client.intlGet(interaction.guildId, 'notExistInSubscription', {
                        name: missingNames.join(', ')
                    });
                    response += response === '' ? missingStr : `\n${missingStr}`;
                }

                const embedType = removedNames.length > 0 ? 0 : 1;

                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(embedType, response,
                    serverTitle));

                rustplus.log(client.intlGet(interaction.guildId, removedNames.length > 0 ? 'infoCap' : 'warningCap'),
                    response);

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
                    id: `${verifyId}`,
                    value: `subscribe, ${subscribeItemName}, ${subscribeItemId}, ${orderType}`
                }));
            } break;

            case 'list': {
                const names = { all: '', buy: '', sell: '' };
                for (const [orderType, itemIds] of Object.entries(instance.marketSubscriptionList)) {
                    for (const itemId of itemIds) {
                        names[orderType] += `\`${client.items.getName(itemId)} (${itemId})\`\n`;
                    }
                }

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
                    id: `${verifyId}`,
                    value: `list`
                }));

                await client.interactionEditReply(interaction, {
                    embeds: [DiscordEmbeds.getEmbed({
                        color: Constants.COLOR_DEFAULT,
                        title: client.intlGet(interaction.guildId, 'subscriptionList'),
                        footer: { text: instance.serverList[rustplus.serverId].title },
                        fields: [
                            {
                                name: client.intlGet(interaction.guildId, 'all'),
                                value: names['all'] === '' ? '\u200B' : names['all'],
                                inline: true
                            },
                            {
                                name: client.intlGet(interaction.guildId, 'buy'),
                                value: names['buy'] === '' ? '\u200B' : names['buy'],
                                inline: true
                            },
                            {
                                name: client.intlGet(interaction.guildId, 'sell'),
                                value: names['sell'] === '' ? '\u200B' : names['sell'],
                                inline: true
                            }]
                    })],
                    ephemeral: true
                });

                rustplus.log(client.intlGet(interaction.guildId, 'infoCap'),
                    client.intlGet(interaction.guildId, 'showingSubscriptionList'));
            } break;

            default: {

            } break;
        }
    },
}