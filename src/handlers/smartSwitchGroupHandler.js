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
const Timer = require('../util/timer');

function ensureGroupSyncDefaults(instance, serverId, groupId) {
    const server = instance.serverList[serverId];
    if (!server || !server.switchGroups.hasOwnProperty(groupId)) return null;

    const group = server.switchGroups[groupId];

    if (!group.hasOwnProperty('syncEnabled')) group.syncEnabled = false;
    if (!group.hasOwnProperty('syncDelay')) group.syncDelay = 60;
    if (!group.hasOwnProperty('syncState') || typeof group.syncState !== 'object' || group.syncState === null) {
        group.syncState = {};
    }

    return group;
}

function getGroupSyncTimeoutKey(groupId, switchId) {
    return `${groupId}:${switchId}`;
}

function clearGroupSyncTimeouts(rustplus, groupId, switchId = null) {
    if (!rustplus || !rustplus.groupSyncTimeouts) return;

    if (switchId !== null && switchId !== undefined) {
        const key = getGroupSyncTimeoutKey(groupId, switchId);
        if (rustplus.groupSyncTimeouts.hasOwnProperty(key)) {
            clearTimeout(rustplus.groupSyncTimeouts[key]);
            delete rustplus.groupSyncTimeouts[key];
        }
        return;
    }

    for (const [key, timeout] of Object.entries(rustplus.groupSyncTimeouts)) {
        if (key.startsWith(`${groupId}:`)) {
            clearTimeout(timeout);
            delete rustplus.groupSyncTimeouts[key];
        }
    }
}

async function scheduleGroupSyncRevert(client, rustplus, guildId, serverId, groupId, switchId) {
    if (!rustplus || rustplus.serverId !== serverId) return;

    const instance = client.getInstance(guildId);
    const group = ensureGroupSyncDefaults(instance, serverId, groupId);
    if (!group || !group.syncEnabled || group.syncDelay <= 0) return;

    if (!rustplus.groupSyncTimeouts) rustplus.groupSyncTimeouts = {};

    const key = getGroupSyncTimeoutKey(groupId, switchId);
    if (rustplus.groupSyncTimeouts.hasOwnProperty(key)) {
        clearTimeout(rustplus.groupSyncTimeouts[key]);
    }

    const delay = group.syncDelay * 1000;
    rustplus.groupSyncTimeouts[key] = setTimeout(async () => {
        const currentRustplus = client.rustplusInstances[guildId];
        if (!currentRustplus || currentRustplus.serverId !== serverId) {
            clearGroupSyncTimeouts(currentRustplus, groupId, switchId);
            return;
        }

        const updatedInstance = client.getInstance(guildId);
        if (!updatedInstance.serverList.hasOwnProperty(serverId)) {
            clearGroupSyncTimeouts(currentRustplus, groupId, switchId);
            return;
        }

        const server = updatedInstance.serverList[serverId];
        if (!server.switchGroups.hasOwnProperty(groupId) || !server.switches.hasOwnProperty(switchId)) {
            clearGroupSyncTimeouts(currentRustplus, groupId, switchId);
            return;
        }

        const updatedGroup = ensureGroupSyncDefaults(updatedInstance, serverId, groupId);
        if (!updatedGroup || !updatedGroup.syncEnabled) {
            clearGroupSyncTimeouts(currentRustplus, groupId, switchId);
            return;
        }

        const desiredState = updatedGroup.syncState[switchId];
        if (typeof desiredState !== 'boolean') {
            clearGroupSyncTimeouts(currentRustplus, groupId, switchId);
            return;
        }

        const switchEntity = server.switches[switchId];
        if (switchEntity.active === desiredState) {
            clearGroupSyncTimeouts(currentRustplus, groupId, switchId);
            return;
        }

        currentRustplus.interactionSwitches.push(switchId);

        const response = await currentRustplus.turnSmartSwitchAsync(parseInt(switchId, 10), desiredState);
        if (!(await currentRustplus.isResponseValid(response))) {
            currentRustplus.interactionSwitches = currentRustplus.interactionSwitches.filter(e => e !== switchId);
            clearGroupSyncTimeouts(currentRustplus, groupId, switchId);
            return;
        }

        server.switches[switchId].active = desiredState;
        server.switches[switchId].reachable = true;
        client.setInstance(guildId, updatedInstance);

        await DiscordMessages.sendSmartSwitchMessage(guildId, serverId, switchId);
        await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);

        clearGroupSyncTimeouts(currentRustplus, groupId, switchId);
    }, delay);
}

module.exports = {
    handler: async function (rustplus, client) {
    },

    updateSwitchGroupIfContainSwitch: async function (client, guildId, serverId, switchId) {
        const instance = client.getInstance(guildId);
        const server = instance.serverList[serverId];
        const switchIdStr = `${switchId}`;
        const rustplus = client.rustplusInstances[guildId];
        let updated = false;

        for (const [groupId, content] of Object.entries(server.switchGroups)) {
            const group = ensureGroupSyncDefaults(instance, serverId, groupId);

            if (content.switches.includes(switchIdStr)) {
                if (group.syncEnabled && server.switches.hasOwnProperty(switchIdStr)) {
                    const switchEntity = server.switches[switchIdStr];

                    if (typeof group.syncState[switchIdStr] !== 'boolean') {
                        group.syncState[switchIdStr] = switchEntity.active;
                        updated = true;
                    }

                    if (group.syncDelay > 0) {
                        if (switchEntity.active === group.syncState[switchIdStr]) {
                            clearGroupSyncTimeouts(rustplus, groupId, switchIdStr);
                        }
                        else {
                            await scheduleGroupSyncRevert(client, rustplus, guildId, serverId, groupId, switchIdStr);
                        }
                    }
                    else {
                        clearGroupSyncTimeouts(rustplus, groupId, switchIdStr);
                    }
                }
                else {
                    clearGroupSyncTimeouts(rustplus, groupId, switchIdStr);
                }

                await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);
            }
        }

        if (updated) {
            client.setInstance(guildId, instance);
        }

    },

    getGroupsFromSwitchList: function (client, guildId, serverId, switches) {
        const instance = client.getInstance(guildId);

        let groupsId = [];
        for (let entity of switches) {
            for (const [groupId, content] of Object.entries(instance.serverList[serverId].switchGroups)) {
                if (content.switches.includes(entity) && !groupsId.includes(groupId)) {
                    groupsId.push(groupId);
                }
            }
        }

        return groupsId;
    },

    TurnOnOffGroup: async function (client, rustplus, guildId, serverId, groupId, value) {
        const instance = client.getInstance(guildId);
        const group = ensureGroupSyncDefaults(instance, serverId, groupId);
        const switches = group.switches;
        const server = instance.serverList[serverId];

        const actionSwitches = [];
        for (const [entityId, content] of Object.entries(server.switches)) {
            if (switches.includes(entityId)) {
                clearGroupSyncTimeouts(rustplus, groupId, entityId);

                if (rustplus.currentSwitchTimeouts.hasOwnProperty(entityId)) {
                    clearTimeout(rustplus.currentSwitchTimeouts[entityId]);
                    delete rustplus.currentSwitchTimeouts[entityId];
                }

                if (value && !content.active) {
                    actionSwitches.push(entityId);
                }
                else if (!value && content.active) {
                    actionSwitches.push(entityId);
                }
            }
        }

        for (const entityId of actionSwitches) {
            const prevActive = server.switches[entityId].active;
            server.switches[entityId].active = value;
            client.setInstance(guildId, instance);

            rustplus.interactionSwitches.push(entityId);

            const response = await rustplus.turnSmartSwitchAsync(entityId, value);
            if (!(await rustplus.isResponseValid(response))) {
                if (server.switches[entityId].reachable) {
                    await DiscordMessages.sendSmartSwitchNotFoundMessage(guildId, serverId, entityId);
                }
                server.switches[entityId].reachable = false;
                server.switches[entityId].active = prevActive;
                client.setInstance(guildId, instance);

                rustplus.interactionSwitches = rustplus.interactionSwitches.filter(e => e !== entityId);
            }
            else {
                server.switches[entityId].reachable = true;
                client.setInstance(guildId, instance);
                if (group.syncEnabled) {
                    group.syncState[entityId] = value;
                    client.setInstance(guildId, instance);
                }
            }

            DiscordMessages.sendSmartSwitchMessage(guildId, serverId, entityId);
        }

        if (actionSwitches.length !== 0) {
            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);
        }
    },

    smartSwitchGroupCommandHandler: async function (rustplus, client, command) {
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;
        const instance = client.getInstance(guildId);
        const switchGroups = instance.serverList[serverId].switchGroups;
        const prefix = rustplus.generalSettings.prefix;

        const onCap = client.intlGet(rustplus.guildId, 'onCap');
        const offCap = client.intlGet(rustplus.guildId, 'offCap');
        const notFoundCap = client.intlGet(rustplus.guildId, 'notFoundCap');

        const onEn = client.intlGet('en', 'commandSyntaxOn');
        const onLang = client.intlGet(guildId, 'commandSyntaxOn');
        const offEn = client.intlGet('en', 'commandSyntaxOff');
        const offLang = client.intlGet(guildId, 'commandSyntaxOff');
        const statusEn = client.intlGet('en', 'commandSyntaxStatus');
        const statusLang = client.intlGet(guildId, 'commandSyntaxStatus');

        const groupId = Object.keys(switchGroups).find(e =>
            command === `${prefix}${switchGroups[e].command}` ||
            command.startsWith(`${prefix}${switchGroups[e].command} `));

        if (!groupId) return false;

        const groupCommand = `${prefix}${switchGroups[groupId].command}`;
        let rest = command.replace(`${groupCommand} ${onEn}`, '');
        rest = rest.replace(`${groupCommand} ${onLang}`, '');
        rest = rest.replace(`${groupCommand} ${offEn}`, '');
        rest = rest.replace(`${groupCommand} ${offLang}`, '');
        rest = rest.replace(`${groupCommand}`, '').trim();

        let active;
        if (command.startsWith(`${groupCommand} ${onEn}`) || command.startsWith(`${groupCommand} ${onLang}`)) {
            active = true;
        }
        else if (command.startsWith(`${groupCommand} ${offEn}`) || command.startsWith(`${groupCommand} ${offLang}`)) {
            active = false;
        }
        else if (command === `${groupCommand} ${statusEn}` || command === `${groupCommand} ${statusLang}`) {
            const switchStatus = switchGroups[groupId].switches.map(switchId => {
                const { active, name, reachable } = instance.serverList[serverId].switches[switchId];
                return { active, name, reachable }
            });
            const statusMessage = switchStatus.map(status =>
                `${status.name}: ${status.reachable ? (status.active ? onCap : offCap) : notFoundCap}`).join(', ');
            rustplus.sendInGameMessage(`${client.intlGet(guildId, 'status')}: ${statusMessage}`);
            return true;
        }
        else {
            return true;
        }

        if (rustplus.currentSwitchTimeouts.hasOwnProperty(groupId)) {
            clearTimeout(rustplus.currentSwitchTimeouts[groupId]);
            delete rustplus.currentSwitchTimeouts[groupId];
        }

        const timeSeconds = Timer.getSecondsFromStringTime(rest);

        let str = client.intlGet(guildId, 'turningGroupOnOff', {
            group: switchGroups[groupId].name,
            status: active ? onCap : offCap
        });

        rustplus.log(client.intlGet(null, 'infoCap'), client.intlGet(null, `logSmartSwitchGroupValueChange`, {
            value: active
        }));

        if (timeSeconds === null) {
            rustplus.sendInGameMessage(str);
            await module.exports.TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, active);
            return true;
        }

        const time = Timer.secondsToFullScale(timeSeconds);
        str += client.intlGet(guildId, 'automaticallyTurnBackOnOff', {
            status: active ? offCap : onCap,
            time: time
        });

        rustplus.currentSwitchTimeouts[groupId] = setTimeout(async function () {
            const instance = client.getInstance(guildId);
            if (!instance.serverList.hasOwnProperty(serverId) ||
                !instance.serverList[serverId].switchGroups.hasOwnProperty(groupId)) {
                return;
            }

            const str = client.intlGet(guildId, 'automaticallyTurningBackOnOff', {
                device: instance.serverList[serverId].switchGroups[groupId].name,
                status: !active ? onCap : offCap
            });
            rustplus.sendInGameMessage(str);

            await module.exports.TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, !active);
        }, timeSeconds * 1000);

        rustplus.sendInGameMessage(str);
        await module.exports.TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, active);
        return true;
    },

    ensureGroupSyncDefaults: function (instance, serverId, groupId) {
        return ensureGroupSyncDefaults(instance, serverId, groupId);
    },

    clearGroupSyncTimeouts: function (rustplus, groupId, switchId = null) {
        clearGroupSyncTimeouts(rustplus, groupId, switchId);
    },
}