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

const DiscordMessages = require('../discordTools/discordMessages.js');
const Config = require('../../config');

const DEFAULT_RECONNECT_INTERVAL_MS = 15000;

function getReconnectDelay() {
    const parsed = Number(Config.general.reconnectIntervalMs);
    if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
    }

    return DEFAULT_RECONNECT_INTERVAL_MS;
}

async function scheduleRustplusReconnect(rustplus, client) {
    if (!rustplus || rustplus.isDeleted) {
        return false;
    }

    const guildId = rustplus.guildId;
    if (!client.activeRustplusInstances[guildId]) {
        return false;
    }

    const serverId = rustplus.serverId;
    const alreadyReconnecting = Boolean(client.rustplusReconnecting[guildId]);

    if (!alreadyReconnecting) {
        await DiscordMessages.sendServerChangeStateMessage(guildId, serverId, 1);
        await DiscordMessages.sendServerMessage(guildId, serverId, 2);
    }

    client.rustplusReconnecting[guildId] = true;

    rustplus.log(client.intlGet(null, 'reconnectingCap'), client.intlGet(null, 'reconnectingToServer'));

    delete client.rustplusInstances[guildId];

    if (client.rustplusReconnectTimers[guildId]) {
        clearTimeout(client.rustplusReconnectTimers[guildId]);
        client.rustplusReconnectTimers[guildId] = null;
    }

    client.rustplusReconnectTimers[guildId] = setTimeout(
        client.createRustplusInstance.bind(client),
        getReconnectDelay(),
        guildId,
        rustplus.server,
        rustplus.port,
        rustplus.playerId,
        rustplus.playerToken
    );

    return true;
}

module.exports = scheduleRustplusReconnect;
