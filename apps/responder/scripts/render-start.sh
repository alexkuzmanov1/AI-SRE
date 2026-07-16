#!/bin/sh
# Boot script for hosted deploys (Render): clone/refresh the monitored repo
# the agent investigates and patches, then start the responder.
set -e

: "${TARGET_REPO:?TARGET_REPO must be set (owner/repo)}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN must be set}"
export TARGET_REPO_PATH="${TARGET_REPO_PATH:-/tmp/demo-app}"

if [ ! -d "$TARGET_REPO_PATH/.git" ]; then
  echo "cloning $TARGET_REPO into $TARGET_REPO_PATH"
  git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/${TARGET_REPO}.git" "$TARGET_REPO_PATH"
else
  echo "refreshing existing clone at $TARGET_REPO_PATH"
  git -C "$TARGET_REPO_PATH" fetch origin
  git -C "$TARGET_REPO_PATH" checkout main
  git -C "$TARGET_REPO_PATH" reset --hard origin/main
fi

# Identity for the fix commits the PR service creates.
git -C "$TARGET_REPO_PATH" config user.name "AI SRE Responder"
git -C "$TARGET_REPO_PATH" config user.email "ai-sre-responder@users.noreply.github.com"

exec node dist/main.js
