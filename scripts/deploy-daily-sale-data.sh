#!/bin/sh
set -eu

repo_path=${BABY_ITEM_REPO_PATH:-/opt/stacks/euni-baby-items}
catalog_files="
config/official-purchase-links.json
data/data-quality-report.json
src/data/items.json
"

cd "$repo_path"

git fetch --quiet origin main
current_sha=$(git rev-parse HEAD)
target_sha=$(git rev-parse origin/main)

if [ "$current_sha" = "$target_sha" ]; then
  exit 0
fi

if ! git merge-base --is-ancestor "$current_sha" "$target_sha"; then
  echo "origin/main is not a fast-forward from $current_sha" >&2
  exit 1
fi

if [ "$(git log -1 --format=%s "$target_sha")" != "chore: refresh daily sale data" ]; then
  echo "A non-catalog release is waiting for manual deployment."
  exit 0
fi

for changed_file in $(git diff --name-only "$current_sha" "$target_sha"); do
  case "$changed_file" in
    config/official-purchase-links.json | data/data-quality-report.json | src/data/items.json) ;;
    *)
      echo "Refusing automatic deployment with non-catalog change: $changed_file" >&2
      exit 0
      ;;
  esac
done

git merge --ff-only origin/main

if docker compose up -d --build --wait --wait-timeout 90 --no-deps euni-baby-items &&
  curl -fsS http://127.0.0.1:1206/ >/dev/null &&
  curl -fsS https://sonleeeun.site/ >/dev/null; then
  exit 0
fi

echo "Deployment failed; rebuilding the previous catalog." >&2

restore_current_catalog() {
  git restore --source=HEAD -- $catalog_files
}

trap restore_current_catalog EXIT HUP INT TERM
git restore --source="$current_sha" -- $catalog_files
docker compose up -d --build --wait --wait-timeout 90 --no-deps euni-baby-items
curl -fsS http://127.0.0.1:1206/ >/dev/null
curl -fsS https://sonleeeun.site/ >/dev/null
exit 1
