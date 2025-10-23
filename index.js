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

const { GatewayIntentBits } = require('discord.js');
const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const DiscordBot = require('./src/structures/DiscordBot');

createMissingDirectories();

const client = new DiscordBot({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    retryLimit: 2,
    restRequestTimeout: 60000,
    disableEveryone: false
});

client.build();

function createMissingDirectories() {
    const directories = ['logs', 'instances', 'credentials', 'maps'];

    for (const directory of directories) {
        const targetPath = join(__dirname, directory);

        if (!existsSync(targetPath)) {
            mkdirSync(targetPath, { recursive: true });
        }
    }
}

process.on('unhandledRejection', error => {
    client.log(
        client.intlGet(null, 'errorCap'),
        client.intlGet(null, 'unhandledRejection', { error }),
        'error'
    );

    console.error(error);
});

module.exports = { client };
