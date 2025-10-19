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

function sanitizeName(name) {
    if (typeof name !== 'string') return '';
    return name.trim();
}

function ensureTeamRoster(instance, serverId) {
    let changed = false;

    if (!instance.hasOwnProperty('teamRosterHistory') ||
        typeof instance.teamRosterHistory !== 'object' ||
        instance.teamRosterHistory === null) {
        instance.teamRosterHistory = {};
        changed = true;
    }

    if (!instance.teamRosterHistory.hasOwnProperty(serverId) ||
        typeof instance.teamRosterHistory[serverId] !== 'object' ||
        instance.teamRosterHistory[serverId] === null) {
        instance.teamRosterHistory[serverId] = {};
        changed = true;
    }

    return {
        roster: instance.teamRosterHistory[serverId],
        changed: changed
    };
}

function upsertRosterPlayers(roster, players = [], options = {}) {
    if (!roster || typeof roster !== 'object') return false;

    const now = Date.now();
    const defaultLastSeen = typeof options.defaultLastSeenAt === 'number' &&
        Number.isFinite(options.defaultLastSeenAt) ? options.defaultLastSeenAt : now;
    const updateLastSeen = options.hasOwnProperty('updateLastSeen') ?
        options.updateLastSeen : true;

    let changed = false;

    for (const player of players) {
        if (!player) continue;

        const steamIdCandidate = player.steamId ?? player.steamID ?? player.id;
        if (steamIdCandidate === undefined || steamIdCandidate === null) continue;

        const steamId = steamIdCandidate.toString();
        if (steamId === '') continue;

        const existing = roster[steamId];
        const candidateName = sanitizeName(player.name ?? player.displayName ?? player.playerName ?? '');
        const resolvedName = candidateName !== '' ? candidateName :
            (existing && typeof existing.name === 'string' ? existing.name : '');

        let resolvedLastSeen = null;
        if (updateLastSeen) {
            if (typeof player.lastSeenAt === 'number' && Number.isFinite(player.lastSeenAt)) {
                resolvedLastSeen = player.lastSeenAt;
            }
            else {
                resolvedLastSeen = defaultLastSeen;
            }
        }
        else if (existing && typeof existing.lastSeenAt === 'number' && Number.isFinite(existing.lastSeenAt)) {
            resolvedLastSeen = existing.lastSeenAt;
        }

        if (!existing) {
            roster[steamId] = {
                steamId: steamId,
                name: resolvedName,
                lastSeenAt: resolvedLastSeen
            };
            changed = true;
            continue;
        }

        if (resolvedName !== '' && resolvedName !== existing.name) {
            existing.name = resolvedName;
            changed = true;
        }

        if (updateLastSeen && resolvedLastSeen &&
            (!existing.lastSeenAt || resolvedLastSeen > existing.lastSeenAt)) {
            existing.lastSeenAt = resolvedLastSeen;
            changed = true;
        }
    }

    return changed;
}

function sortRosterEntries(entries) {
    return entries.sort((a, b) => {
        const nameA = sanitizeName(a.name ?? '');
        const nameB = sanitizeName(b.name ?? '');

        if (nameA === '' && nameB === '') return a.steamId.localeCompare(b.steamId);
        if (nameA === '') return 1;
        if (nameB === '') return -1;

        const localeNameA = nameA.toLocaleLowerCase();
        const localeNameB = nameB.toLocaleLowerCase();

        if (localeNameA === localeNameB) return a.steamId.localeCompare(b.steamId);
        return localeNameA.localeCompare(localeNameB);
    });
}

function rosterToArray(roster) {
    if (!roster || typeof roster !== 'object') return [];

    const entries = [];

    for (const [steamId, data] of Object.entries(roster)) {
        if (!steamId) continue;

        if (!data || typeof data !== 'object') {
            entries.push({
                steamId: steamId,
                name: '',
                lastSeenAt: null
            });
            continue;
        }

        const name = sanitizeName(data.name ?? '');
        const lastSeenAt = typeof data.lastSeenAt === 'number' && Number.isFinite(data.lastSeenAt) ?
            data.lastSeenAt : null;

        entries.push({
            steamId: steamId,
            name: name,
            lastSeenAt: lastSeenAt
        });
    }

    return sortRosterEntries(entries);
}

module.exports = {
    ensureTeamRoster: ensureTeamRoster,
    rosterToArray: rosterToArray,
    sanitizeName: sanitizeName,
    sortRosterEntries: sortRosterEntries,
    upsertRosterPlayers: upsertRosterPlayers
};
