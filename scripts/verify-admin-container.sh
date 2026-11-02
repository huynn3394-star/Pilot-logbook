#!/usr/bin/env bash
set -euo pipefail
image="avilog-admin-smoke:${GITHUB_SHA:-local}"
name="avilog-admin-smoke-${GITHUB_RUN_ID:-local}"
volume="${name}-data"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; docker volume rm "$volume" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker build -t "$image" .
docker volume create "$volume" >/dev/null
start() {
  docker run -d --name "$name" -e PORT=3000 -e AVILOG_ADMIN_ENABLED=false -e RAILWAY_VOLUME_MOUNT_PATH=/data -v "$volume:/data" "$image" >/dev/null
  for attempt in {1..20}; do
    if docker exec "$name" node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then return; fi
    sleep 1
  done
  docker logs "$name"
  return 1
}
start
docker exec -i --user 1000 "$name" node --input-type=module <<'JS'
import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createUsageStore} from './lib/admin.js';
const uid=fs.readFileSync('/proc/1/status','utf8').match(/^Uid:\s+(.+)$/m)[1].trim().split(/\s+/).map(Number);assert(uid.every(id=>id===1000),'Application must run as node after volume initialization');
const stat=fs.statSync('/data/avilog-admin');assert.equal(stat.uid,1000);assert.equal(stat.mode&0o777,0o700);
const store=createUsageStore({directory:'/data/avilog-admin'});store.record({visitorId:randomUUID(),sessionId:randomUUID(),eventId:randomUUID(),kind:'page_view',feature:'weather',device:'desktop'});assert.equal(store.overview().summary.today,1);store.close();
console.log('Unprivileged runtime and private volume write passed');
JS
docker rm -f "$name" >/dev/null
start
docker exec -i --user 1000 "$name" node --input-type=module <<'JS'
import assert from 'node:assert/strict';import {createUsageStore} from './lib/admin.js';const store=createUsageStore({directory:'/data/avilog-admin'});assert.equal(store.overview().summary.today,1,'Statistics must survive container replacement');store.close();console.log('Statistics persisted across container replacement');
JS
