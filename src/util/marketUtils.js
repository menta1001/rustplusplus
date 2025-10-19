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

function hasWildcard(str) {
    if (typeof str !== 'string') return false;
    return str.includes('*') || str.includes('?');
}

function shouldIncludeOrder(orderType, trackedSet, itemId, currencyId) {
    if (trackedSet.size === 0) return false;

    const itemMatch = itemId !== null && trackedSet.has(itemId);
    const currencyMatch = currencyId !== null && trackedSet.has(currencyId);

    if (orderType === 'all') {
        return itemMatch || currencyMatch;
    }
    else if (orderType === 'buy') {
        return currencyMatch;
    }
    else if (orderType === 'sell') {
        return itemMatch;
    }

    return false;
}

module.exports = {
    hasWildcard: hasWildcard,

    getItemIdsFromInput(client, guildId, nameInput, idInput) {
        if (nameInput !== null && nameInput !== undefined) {
            if (hasWildcard(nameInput)) {
                const ids = client.items.getItemIdsByWildcard(nameInput);
                if (ids.length === 0) {
                    return { errorKey: 'noItemWithNameFound', errorArgs: { name: nameInput } };
                }

                return { itemIds: ids };
            }

            const itemId = client.items.getClosestItemIdByName(nameInput);
            if (itemId === null) {
                return { errorKey: 'noItemWithNameFound', errorArgs: { name: nameInput } };
            }

            return { itemIds: [itemId] };
        }

        if (idInput !== null && idInput !== undefined) {
            if (client.items.itemExist(idInput)) {
                return { itemIds: [idInput] };
            }

            return { errorKey: 'noItemWithIdFound', errorArgs: { id: idInput } };
        }

        return { errorKey: 'noNameIdGiven' };
    },

    collectMatchingOrders(rustplus, client, guildId, trackedItemIds, orderType) {
        if (!rustplus || !rustplus.mapMarkers || !Array.isArray(rustplus.mapMarkers.vendingMachines)) {
            return [];
        }

        const trackedSet = new Set();
        for (const id of trackedItemIds || []) {
            const parsed = Number.parseInt(id, 10);
            if (!Number.isNaN(parsed)) trackedSet.add(parsed);
        }

        if (trackedSet.size === 0) return [];

        const lines = [];
        const unknownString = client.intlGet(guildId, 'unknown');
        const leftString = client.intlGet(guildId, 'remain');

        for (const vendingMachine of rustplus.mapMarkers.vendingMachines) {
            if (!vendingMachine || !Array.isArray(vendingMachine.sellOrders)) continue;

            const locationString = vendingMachine.location && vendingMachine.location.string
                ? vendingMachine.location.string
                : unknownString;

            for (const order of vendingMachine.sellOrders) {
                if (!order || order.amountInStock === 0) continue;

                const itemId = Number.isInteger(order.itemId) ? order.itemId : null;
                const currencyId = Number.isInteger(order.currencyId) ? order.currencyId : null;

                if (!shouldIncludeOrder(orderType, trackedSet, itemId, currencyId)) continue;

                const itemName = itemId !== null && client.items.itemExist(itemId.toString())
                    ? client.items.getName(itemId.toString())
                    : unknownString;
                const currencyName = currencyId !== null && client.items.itemExist(currencyId.toString())
                    ? client.items.getName(currencyId.toString())
                    : unknownString;

                let line = `+ [${locationString}] ${order.quantity}x ${itemName}`;
                if (order.itemIsBlueprint) line += ' (BP)';
                line += ` for ${order.costPerItem}x ${currencyName}`;
                if (order.currencyIsBlueprint) line += ' (BP)';
                line += ` (${order.amountInStock} ${leftString})`;

                lines.push(line);
            }
        }

        return lines;
    },

    formatDiffLines(lines, maxLength = 4000) {
        if (!Array.isArray(lines) || lines.length === 0) return null;

        const diffLines = [];
        let currentLength = 0;

        for (const line of lines) {
            const lineLength = line.length + 1; /* Account for newline */

            if (currentLength + lineLength > maxLength) {
                diffLines.push('...');
                break;
            }

            diffLines.push(line);
            currentLength += lineLength;
        }

        return '```diff\n' + diffLines.join('\n') + '\n```';
    },
};
