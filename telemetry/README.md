# Telemetry receiver

VS Code → API Gateway → private Cloud Function → `https://yandex.ru/clck/click`
(`rum_events`, path `690.32`) → [CHV Events](https://events.chv.yandex-team.ru).

## Deploy and verify

1. Run `npm run compile:telemetry`. It produces `build/telemetry/index.js` (standalone, no npm dependencies), `test-event.json` (Cloud Functions console) and `test-payload.json` (HTTP).
2. Replace `index.js` in function `d4e78smfm7fspkagvaj2`. Use Node.js 22, entry point `index.handler`, 256 MB, timeout 5 seconds, public access **off** and `TELEMETRY_ENVIRONMENT=testing`. No database/storage credentials are needed.
3. Save the version. In **Testing**, select no template and paste `test-event.json`. Expect `202` with `{"forwarded":3}`. Rebuild fixtures older than 24 hours.
4. In CHV, filter `project == diplodoc-vsc`, environment `testing`. Find all three fixture event IDs in Items (`requestId`), with the same non-null `yandexuid`. HTTP acceptance alone does not prove ingestion.
5. Grant service account `aje26jt8j7brfphr3kk1` `functions.functionInvoker` on the function. Create API Gateway in folder `b1g1j115gl75k4sqiu0m` using [api-gateway.yaml](api-gateway.yaml). It invokes the private function as this account.
6. Copy the gateway HTTPS service URL and append `/telemetry`. Test the complete route when ready to ingest the fixture events:

```sh
curl --fail-with-body 'https://YOUR_GATEWAY.apigw.yandexcloud.net/telemetry' \
  -H 'Content-Type: application/json' \
  --data-binary @build/telemetry/test-payload.json
```

7. Build the extension with that URL, or set the GitHub repository **Actions variable** `DIPLODOC_TELEMETRY_ENDPOINT` for both release workflows:

```sh
DIPLODOC_TELEMETRY_ENDPOINT='https://YOUR_GATEWAY.apigw.yandexcloud.net/telemetry' npm run compile
npm run vsce
```

The URL is embedded at build time; an unset variable disables collection. A workspace or document cannot override it. Switch the function to `TELEMETRY_ENVIRONMENT=production` for release; clients cannot choose the environment, project or collector URL.

8. Install the VSIX, open the editor or find references, then check CHV after about 10 seconds. VS Code `telemetry.telemetryLevel=all` permits usage and errors; `error` permits classified errors only; `off`/`crash` disables both. Verify that disabling telemetry stops further extension requests.

SWS/Advanced Rate Limiter attachment is deferred for the initial rollout. The public gateway currently accepts anonymous requests without a configured SWS rate limit; validation does not prevent forged statistics. For later attachment, see the [SWS integration](https://yandex.cloud/ru/docs/api-gateway/concepts/extensions/sws). Prepared limits are 10 requests/second globally and 120/minute per IP; shared NATs require tuning. Use blocking without browser challenges or CAPTCHA.

## Data contract

- [schema.ts](../src/modules/telemetry/schema.ts) allows the existing 17 event names, enumerated dimensions and bounded counters. Documents, paths, logins, cookies, hostnames, machine IDs and exception messages/stacks are excluded. Native common properties and automatic unhandled errors are disabled.
- A random installation UUID persists in VS Code globalState without Settings Sync. The collector hashes it into a project-scoped UInt64 `yandexuid`: CHV Users counts installations. Every activation gets a fresh `additional.sessionId`.
- Use Name for feature frequency, Additional for OS, VS Code version and approved dimensions. `references/find` has ValueInteger equal to the reference count; other events have value 1. Count rows for frequency rather than summing values across different names.
- `md-editor/mode` records the initial mode; `project/init` records an attempt, not successful completion. Errors are ordinary events with `additional.kind=error`, without crash stacks.
- The queue holds 100 pending events, sends up to 20 every 10 seconds and expires them after 5 minutes. It makes at most 3 attempts with stable event IDs; 4xx other than 408/429 are not retried. Shutdown attempts one final batch. Delivery is best effort; use distinct `requestId` to deduplicate retries.
- Opt-out clears disallowed pending events and aborts the current request. Already received events cannot be recalled. The function validates JSON batches up to 64 KiB and does not forward incoming HTTP headers.
- CHV IP/geolocation describes the function's egress; gateway/platform logs can contain client IPs. Project filters are not ACLs, and the shared service controls retention. Scheduled YT export is separate work: use the supported [YQL route](https://docs.yandex-team.ru/error-booster/), not the CHV UI API.
