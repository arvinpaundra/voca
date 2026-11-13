#!/bin/sh
# Usage: lint-commit.sh "<header>" — exits 1 if it isn't a Conventional Commit header.
# Shared by .githooks/commit-msg and the CI PR-title check. Rules: AGENTS.md "Commits and PRs".
types='feat|fix|docs|refactor|test|chore|ci|build|perf|revert'
scopes='contract|be|fe|docs|tasks|lint|ci|verify'
re="^($types)(\(($scopes)(/[a-z0-9-]+)?\))?!?: [a-z0-9\`](.*[^.])?$"
case "$1" in "Merge "* | "Revert \""*) exit 0 ;; esac
if [ "${#1}" -gt 72 ] || ! printf '%s\n' "$1" | grep -Eq "$re"; then
  echo "bad header: $1" >&2
  echo "want: type(scope): subject — types: $types; scopes: $scopes (be may add /<context>)" >&2
  echo "subject: lowercase start, no trailing period, header <= 72 chars" >&2
  exit 1
fi
