#!/usr/bin/env bash
set -euo pipefail
image="avilog-admin-smoke:${GITHUB_SHA:-local}"
name="avilog-admin-smoke-${GITHUB_RUN_ID:-local}"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker build -t "$image" .
docker run -d --name "$name" -e PORT=3000 -e ATPL_ACCOUNTS_ENABLED=true -e ATPL_APP_ORIGIN=http://localhost:3000 -e FIREBASE_PROJECT_ID=demo-avilog -e FIREBASE_API_KEY=public-test-key -e FIREBASE_APP_ID=test-app -e AVILOG_ADMIN_ENABLED=true -e AVILOG_ADMIN_EMAILS=owner@example.test -e AVILOG_ADMIN_MEMORY_ONLY=true "$image" >/dev/null
ready=false
for attempt in {1..20}; do
  if docker exec "$name" node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then docker logs "$name"; exit 1; fi
docker exec -i --user 1000 "$name" node --input-type=module <<'JS'
import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const uid=fs.readFileSync('/proc/1/status','utf8').match(/^Uid:\s+(.+)$/m)[1].trim().split(/\s+/).map(Number);assert(uid.every(id=>id===1000),'Application must run as node');
const base='http://127.0.0.1:3000';
assert.equal((await fetch(base+'/admin/')).status,200);
assert.equal((await fetch(base+'/api/admin/overview')).status,401,'Private API must be routed and protected');
const response=await fetch(base+'/api/usage/event',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({visitorId:randomUUID(),sessionId:randomUUID(),eventId:randomUUID(),kind:'page_view',feature:'weather',device:'desktop'})});assert.equal(response.status,204,'Memory mode must collect without a volume');
console.log('Actual container: non-root, protected admin API, anonymous collection without a volume passed');
JS
