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

const Path = require('path');

const Client = require('../../index.ts');
const JsonFileCache = require('./jsonFileCache');

function getInstancePath(guildId) {
    return Path.join(__dirname, '..', '..', 'instances', `${guildId}.json`);
}

function getCredentialsPath(guildId) {
    return Path.join(__dirname, '..', '..', 'credentials', `${guildId}.json`);
}

module.exports = {
    getSmartDevice: function (guildId, entityId) {
        /* Temporary function till discord modals gets more functional */
        const instance = Client.client.getInstance(guildId);

        for (const serverId in instance.serverList) {
            for (const switchId in instance.serverList[serverId].switches) {
                if (entityId === switchId) return { type: 'switch', serverId: serverId }
            }
            for (const alarmId in instance.serverList[serverId].alarms) {
                if (entityId === alarmId) return { type: 'alarm', serverId: serverId }
            }
            for (const storageMonitorId in instance.serverList[serverId].storageMonitors) {
                if (entityId === storageMonitorId) return { type: 'storageMonitor', serverId: serverId }
            }
        }
        return null;
    },

    readInstanceFile: function (guildId) {
        return JsonFileCache.readJson(getInstancePath(guildId));
    },

    writeInstanceFile: function (guildId, instance) {
        JsonFileCache.writeJson(getInstancePath(guildId), instance);
    },

    invalidateInstanceCache: function (guildId) {
        JsonFileCache.invalidate(getInstancePath(guildId));
    },

    readCredentialsFile: function (guildId) {
        return JsonFileCache.readJson(getCredentialsPath(guildId));
    },

    writeCredentialsFile: function (guildId, credentials) {
        JsonFileCache.writeJson(getCredentialsPath(guildId), credentials);
    },

    invalidateCredentialsCache: function (guildId) {
        JsonFileCache.invalidate(getCredentialsPath(guildId));
    },
}
