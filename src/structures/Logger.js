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

const Colors = require("colors");
const Winston = require("winston");

const Config = require('../../config');
const Client = require('../../index');

class Logger {
    constructor(logFilePath, type) {
        this.logger = Winston.createLogger({
            transports: [new Winston.transports.File({
                filename: logFilePath,
                maxsize: 10000000,
                maxFiles: 2,
                tailable: true
            })],
        });

        this.type = type;
        this.guildId = null;
        this.serverName = null;
    }

    setGuildId(guildId) {
        this.guildId = guildId;
    }

    getTime() {
        let d = new Date();

        let year = d.getFullYear();
        let month = d.getMonth() + 1;
        let date = d.getDate() < 10 ? ('0' + d.getDate()) : d.getDate();
        let hours = d.getHours() < 10 ? ('0' + d.getHours()) : d.getHours();
        let minutes = d.getMinutes() < 10 ? ('0' + d.getMinutes()) : d.getMinutes();
        let seconds = d.getSeconds() < 10 ? ('0' + d.getSeconds()) : d.getSeconds();

        return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
    }

    resolveLevel(level, title) {
        if (typeof level === 'string') {
            const normalizedLevel = level.toLowerCase();

            if (normalizedLevel === 'error') {
                return 'error';
            }

            if (normalizedLevel === 'warn' || normalizedLevel === 'warning') {
                return 'warn';
            }
        }

        if (typeof title !== 'string') {
            return 'info';
        }

        const client = Client.client;
        if (!client) {
            return 'info';
        }

        const normalizedTitle = title.trim().toLowerCase();

        const guildId = (this.type === 'guild') ? this.guildId : null;

        try {
            const warningTitle = client.intlGet(guildId, 'warningCap');
            const errorTitle = client.intlGet(guildId, 'errorCap');

            if (warningTitle && normalizedTitle === warningTitle.toLowerCase()) {
                return 'warn';
            }

            if (errorTitle && normalizedTitle === errorTitle.toLowerCase()) {
                return 'error';
            }
        }
        catch (e) {
            /* Fallback to info */
        }

        return 'info';
    }

    dispatchToDiscord(level, title, text) {
        if (!['error', 'warn'].includes(level)) {
            return;
        }

        const client = Client.client;

        if (!client || typeof client.handleLogDispatch !== 'function') {
            return;
        }

        const payload = {
            level,
            title,
            text,
            timestamp: new Date(),
        };

        if (this.type === 'guild') {
            payload.guildId = this.guildId;
            payload.serverName = this.serverName;
            payload.source = 'Rust+';
        }
        else {
            payload.source = 'Bot';
        }

        client.handleLogDispatch(this.type, payload);
    }

    log(title, text, level) {
        const resolvedLevel = this.resolveLevel(level, title);
        const time = this.getTime();

        switch (this.type) {
            case 'default': {
                const messageText = `${title}: ${text}`;
                this.logger.log({
                    level: resolvedLevel,
                    message: `${time} | ${messageText}`
                });

                console.log(
                    Colors.green(`${time} `) +
                    ((resolvedLevel === 'error') ? Colors.red(messageText) : Colors.yellow(messageText))
                );

                if (resolvedLevel === 'error' && Config.general.showCallStackError) {
                    for (let line of (new Error().stack.split(/\r?\n/))) {
                        this.logger.log({ level: resolvedLevel, message: `${time} | ${line}` });
                        console.log(Colors.green(`${time} `) + Colors.red(line));
                    }
                }
            } break;

            case 'guild': {
                const messageText = `${title}: ${text}`;

                this.logger.log({
                    level: resolvedLevel,
                    message: `${time} | ${this.guildId} | ${this.serverName} | ${messageText}`
                });

                console.log(
                    Colors.green(`${time} `) +
                    Colors.cyan(`${this.guildId} `) +
                    Colors.white(`${this.serverName} `) +
                    ((resolvedLevel === 'error') ? Colors.red(messageText) : Colors.yellow(messageText))
                );

                if (resolvedLevel === 'error' && Config.general.showCallStackError) {
                    for (let line of (new Error().stack.split(/\r?\n/))) {
                        this.logger.log({
                            level: resolvedLevel,
                            message: `${time} | ${this.guildId} | ${this.serverName} | ${line}`
                        });
                        console.log(
                            Colors.green(`${time} `) +
                            Colors.cyan(`${this.guildId} `) +
                            Colors.white(`${this.serverName} `) +
                            Colors.red(line));
                    }
                }
            } break;

            default: {
            } break;
        }

        this.dispatchToDiscord(resolvedLevel, title, text);
    }
}

module.exports = Logger;