#!/usr/bin/env bash
# cleanup.sh — removes the container stack spun up for a given Jenkins build.
# Usage: ./cleanup.sh <build_number>
set -euo pipefail

BUILD_NUMBER="${1:-}"

if [ -z "$BUILD_NUMBER" ]; then
  echo "Usage: $0 <build_number>"
  exit 1
fi

echo "Removing containers labeled jenkins-build=${BUILD_NUMBER}..."
docker ps -aq --filter "label=jenkins-build=${BUILD_NUMBER}" | xargs -r docker rm -f

echo "Pruning dangling images..."
docker image prune -f

echo "Cleanup complete for build ${BUILD_NUMBER}."
