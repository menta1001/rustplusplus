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

const scheduleRustplusReconnect = require('../util/scheduleRustplusReconnect');

module.exports = {
    name: 'error',
    async execute(rustplus, client, err) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        rustplus.log(client.intlGet(null, 'errorCap'), err, 'error');

        let shouldScheduleReconnect = false;

        switch (err.code) {
            case 'ETIMEDOUT': {
                shouldScheduleReconnect = errorTimedOut(rustplus, client, err);
            } break;

            case 'ENOTFOUND': {
                shouldScheduleReconnect = errorNotFound(rustplus, client, err);
            } break;

            case 'ECONNREFUSED': {
                shouldScheduleReconnect = errorConnRefused(rustplus, client, err);
            } break;

            default: {
                shouldScheduleReconnect = errorOther(rustplus, client, err);
            } break;
        }

        if (shouldScheduleReconnect) {
            await scheduleRustplusReconnect(rustplus, client);
        }
    },
};

function errorTimedOut(rustplus, client, err) {
    if (err.syscall === 'connect') {
        rustplus.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'couldNotConnectTo', {
            id: rustplus.serverId
        }), 'error');
        return true;
    }
    return false;
}

function errorNotFound(rustplus, client, err) {
    if (err.syscall === 'getaddrinfo') {
        rustplus.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'couldNotConnectTo', {
            id: rustplus.serverId
        }), 'error');
        return true;
    }
    return false;
}

function errorConnRefused(rustplus, client, err) {
    rustplus.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'connectionRefusedTo', {
        id: rustplus.serverId
    }), 'error');
    return true;
}

function errorOther(rustplus, client, err) {
    if (err.toString() === 'Error: WebSocket was closed before the connection was established') {
        rustplus.log(client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'websocketClosedBeforeConnection'), 'error');
        return true;
    }
    return false;
}
