/*
    Copyright (C) 2023 Alexander Emanuelsson (alexemanuelol)

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

const Fs = require('fs');
const Path = require('path');

const htmlReservedSymbols = JSON.parse(
    Fs.readFileSync(
        Path.join(__dirname, '..', 'staticFiles', 'htmlReservedSymbols.json'),
        'utf8',
    ),
);

Object.freeze(htmlReservedSymbols);

function coerceToString(value) {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
}

module.exports = {
    parseArgs: function (str) {
        const input = coerceToString(str).trim();
        return input === '' ? [] : input.split(/\s+/);
    },

    getArgs: function (str, n = 0) {
        const args = this.parseArgs(str);
        const limit = Number.parseInt(n, 10);
        if (!Number.isFinite(limit) || limit < 1) return args;
        const newArgs = [];

        let remain = coerceToString(str);
        let counter = 1;
        for (const arg of args) {
            if (counter === limit) {
                newArgs.push(remain);
                break;
            }
            remain = remain.slice(arg.length).trim();
            newArgs.push(arg);
            counter += 1;
        }

        return newArgs;
    },

    decodeHtml: function (str) {
        let decoded = coerceToString(str);

        for (const [key, value] of Object.entries(htmlReservedSymbols)) {
            if (decoded.includes(key)) {
                decoded = decoded.split(key).join(value);
            }
        }

        return decoded;
    },

    removeInvisibleCharacters: function (str) {
        const input = coerceToString(str);
        if (input === '') return input;

        const withoutZeroWidth = input.replace(/[\u200B-\u200D\uFEFF]/g, '');
        return withoutZeroWidth.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    },

    findClosestString: function (string, array, threshold = 2) {
        if (!Array.isArray(array) || array.length === 0) return null;

        const parsedThreshold = Number(threshold);
        const numericThreshold = Number.isFinite(parsedThreshold)
            ? Math.max(0, parsedThreshold)
            : 2;

        let minDistance = Infinity;
        let closestString = null;
        let foundCandidate = false;

        const target = coerceToString(string);

        for (let i = 0; i < array.length; i++) {
            const currentString = array[i];
            if (typeof currentString !== 'string') continue;

            const distance = levenshteinDistance(target, currentString);

            if (distance < minDistance) {
                minDistance = distance;
                closestString = currentString;
                foundCandidate = true;
            }

            if (minDistance === 0) break;
        }

        if (!foundCandidate) return null;

        return minDistance > numericThreshold ? null : closestString;
    },
}

/* Function to calculate Levenshtein distance between two strings */
function levenshteinDistance(s1, s2) {
    const left = coerceToString(s1).toLowerCase();
    const right = coerceToString(s2).toLowerCase();

    const m = left.length;
    const n = right.length;
    const dp = [];

    for (let i = 0; i <= m; i++) {
        dp[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (left[i - 1] === right[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],
                    dp[i][j - 1],
                    dp[i - 1][j - 1]
                );
            }
        }
    }

    return dp[m][n];
}