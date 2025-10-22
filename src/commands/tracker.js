/*
        Copyright (C) 2024 Alexander Emanuelsson (alexemanuelol)

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

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

module.exports = {
        name: 'tracker',

        getData(client, guildId) {
                return new Builder.SlashCommandBuilder()
                        .setName('tracker')
                        .setDescription(client.intlGet(guildId, 'commandsTrackerDesc'))
                        .addSubcommand(subcommand => subcommand
                                .setName('group')
                                .setDescription(client.intlGet(guildId, 'commandsTrackerInfoDesc'))
                                .addStringOption(option => option
                                        .setName('tracker')
                                        .setDescription(client.intlGet(guildId, 'commandsTrackerTrackerDesc'))
                                        .setRequired(true)));
        },

        async execute(client, interaction) {
                const verifyId = Math.floor(100000 + Math.random() * 900000);
                client.logInteraction(interaction, verifyId, 'slashCommand');

                if (!await client.validatePermissions(interaction)) return;
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                switch (interaction.options.getSubcommand()) {
                        case 'group': {
                                await trackerInfoHandler(client, interaction);
                        } break;

                        default: {
                        } break;
                }

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
                        id: `${verifyId}`,
                        value: `${interaction.options.getSubcommand()} ${interaction.options.getString('tracker')}`
                }));
        },
};

async function trackerInfoHandler(client, interaction) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);

        if (!instance || !instance.trackers || Object.keys(instance.trackers).length === 0) {
                const str = client.intlGet(guildId, 'commandsTrackerNoTrackers');
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(null, 'warningCap'), str);
                return;
        }

        const trackerParameter = interaction.options.getString('tracker');
        const trackers = instance.trackers;

        let trackerId = null;
        if (trackers.hasOwnProperty(trackerParameter)) {
                trackerId = trackerParameter;
        }

        const trackerEntries = Object.entries(trackers);
        const trackerParameterLower = trackerParameter.toLowerCase();

        if (trackerId === null) {
                const exactMatches = trackerEntries.filter(([, tracker]) =>
                        tracker.name.toLowerCase() === trackerParameterLower);

                if (exactMatches.length === 1) {
                        trackerId = exactMatches[0][0];
                }
                else if (exactMatches.length > 1) {
                        const matches = exactMatches.map(([, tracker]) => tracker.name).join(', ');
                        const str = client.intlGet(guildId, 'commandsTrackerMultipleMatches', {
                                tracker: trackerParameter,
                                matches: matches
                        });
                        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                        client.log(client.intlGet(null, 'warningCap'), str);
                        return;
                }
        }

        if (trackerId === null) {
                const partialMatches = trackerEntries.filter(([, tracker]) =>
                        tracker.name.toLowerCase().includes(trackerParameterLower));

                if (partialMatches.length === 1) {
                        trackerId = partialMatches[0][0];
                }
                else if (partialMatches.length > 1) {
                        const matches = partialMatches.map(([, tracker]) => tracker.name).join(', ');
                        const str = client.intlGet(guildId, 'commandsTrackerMultipleMatches', {
                                tracker: trackerParameter,
                                matches: matches
                        });
                        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                        client.log(client.intlGet(null, 'warningCap'), str);
                        return;
                }
        }

        if (trackerId === null) {
                const str = client.intlGet(guildId, 'commandsTrackerNotFound', { tracker: trackerParameter });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(null, 'warningCap'), str);
                return;
        }

        const tracker = trackers[trackerId];
        const embeds = DiscordEmbeds.getTrackerEmbed(guildId, trackerId);

        await client.interactionEditReply(interaction, { embeds });
        client.log(client.intlGet(guildId, 'infoCap'), client.intlGet(guildId, 'trackerInfoHeader', {
                tracker: tracker.name
        }));
}
