#!/usr/bin/env sh
set -eu

compose_file="${1:-compose.yaml}"
docker compose -f "$compose_file" config -q

worker_networks="$(docker inspect push-worker --format '{{range $name, $config := .NetworkSettings.Networks}}{{if $config}}{{println $name}}{{end}}{{end}}')"
echo "$worker_networks" | grep -q 'push_internal'
echo "$worker_networks" | grep -q 'push_egress'

api_networks="$(docker inspect push-api --format '{{range $name, $config := .NetworkSettings.Networks}}{{if $config}}{{println $name}}{{end}}{{end}}')"
echo "$api_networks" | grep -q 'push_internal'
echo "$api_networks" | grep -q 'push_egress'

docker compose -f "$compose_file" exec -T push-api node -e 'fetch("https://fcm.googleapis.com").then(response => console.log(`API egress: HTTP ${response.status}`)).catch(error => { console.error(error); process.exit(1); })'
docker compose -f "$compose_file" exec -T push-worker node services/worker/dist/src/healthcheck.js
docker compose -f "$compose_file" exec -T push-worker node -e '
const dns = require("node:dns").promises;
Promise.all(["fcm.googleapis.com", "oauth2.googleapis.com", "api.push.apple.com"].map(async host => {
  await dns.lookup(host);
  console.log(`${host}: DNS OK`);
})).catch(error => { console.error(error); process.exit(1); });
'

echo "Docker deployment validation passed."
