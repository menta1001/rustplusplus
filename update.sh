#!/usr/bin/env bash

set -euo pipefail

#
#   Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)
#
#   This program is free software: you can redistribute it and/or modify
#   it under the terms of the GNU General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   This program is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU General Public License for more details.
#
#   You should have received a copy of the GNU General Public License
#   along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
#   https://github.com/alexemanuelol/rustplusplus

LOG_PREFIX="[rustplusplus update]"

log() {
    printf '%s %s\n' "$LOG_PREFIX" "$1"
}

fail() {
    printf '%s ERROR: %s\n' "$LOG_PREFIX" "$1" >&2
    exit 1
}

require_command() {
    local cmd=$1
    command -v "$cmd" >/dev/null 2>&1 || fail "Required command '$cmd' is not available"
}

require_command git
require_command npm

if [ ! -d .git ]; then
    fail "This script must be run from the root of the repository"
fi

log "Fetching latest changes"
git fetch origin || fail "Could not fetch latest changes from origin"

DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | sed -n '/HEAD branch/s/.*: //p')
DEFAULT_BRANCH=${DEFAULT_BRANCH:-master}

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
    log "Detached HEAD detected, defaulting to '$DEFAULT_BRANCH'"
    CURRENT_BRANCH="$DEFAULT_BRANCH"
fi

STASH_NAME="auto-update-$(date +%s)"
if ! git diff --quiet --ignore-submodules HEAD; then
    log "Stashing local changes"
    git stash push -u -m "$STASH_NAME" || fail "Could not stash current changes"
    STASH_CREATED=1
else
    STASH_CREATED=0
fi

log "Rebasing onto latest 'origin/$CURRENT_BRANCH'"
git pull --rebase origin "$CURRENT_BRANCH" || fail "Could not rebase onto latest 'origin/$CURRENT_BRANCH'"

if [ "$STASH_CREATED" -eq 1 ]; then
    log "Restoring stashed changes"
    if git stash list | grep -q "$STASH_NAME"; then
        git stash pop || fail "Could not apply stashed changes"
    else
        log "No stash entry matching '$STASH_NAME' found"
    fi
fi

if [ -f package-lock.json ]; then
    log "Discarding local package-lock.json changes"
    git checkout -- package-lock.json || fail "Could not restore package-lock.json"
fi

if [ -f package.json ]; then
    log "Installing npm dependencies"
    npm install || fail "Could not install npm dependencies"
else
    log "No package.json found, skipping npm install"
fi

log "Update completed successfully"
