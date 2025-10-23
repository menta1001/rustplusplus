"use strict";

const Fs = require('fs');

const supportsStructuredClone = typeof structuredClone === 'function';

function clone(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (supportsStructuredClone) {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

class JsonFileCache {
    constructor() {
        this._cache = new Map();
        this._mtimes = new Map();
    }

    readJson(filePath) {
        let stat = null;

        try {
            stat = Fs.statSync(filePath);
        }
        catch (error) {
            if (error && error.code === 'ENOENT') {
                error.message = `JSON file not found: ${filePath}`;
            }

            throw error;
        }

        const cached = this._cache.get(filePath);
        const cachedMtime = this._mtimes.get(filePath);

        if (cached && cachedMtime === stat.mtimeMs) {
            return clone(cached);
        }

        const data = JSON.parse(Fs.readFileSync(filePath, 'utf8'));
        this._cache.set(filePath, clone(data));
        this._mtimes.set(filePath, stat.mtimeMs);

        return clone(data);
    }

    writeJson(filePath, data) {
        const payload = JSON.stringify(data, null, 2);
        Fs.writeFileSync(filePath, payload);

        try {
            const stat = Fs.statSync(filePath);
            this._cache.set(filePath, JSON.parse(payload));
            this._mtimes.set(filePath, stat.mtimeMs);
        }
        catch (error) {
            this.invalidate(filePath);
            throw error;
        }
    }

    invalidate(filePath) {
        this._cache.delete(filePath);
        this._mtimes.delete(filePath);
    }
}

module.exports = new JsonFileCache();
