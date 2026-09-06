# Telemetry receiver

VS Code → API Gateway → private Cloud Function → `https://yandex.ru/clck/click`
(`rum_events`, path `690.32`) → [CHV Events](https://events.chv.yandex-team.ru).
The viewer and the internal ClickHouse cluster are not involved.

## Build and test the private function

Run `npm run compile:telemetry` from the extension root. It creates:

- `build/telemetry/index.js`: standalone CommonJS handler, no npm dependencies.
- `build/telemetry/test-event.json`: input for the Cloud Functions **Testing** tab, without a template.
- `build/telemetry/test-payload.json`: the same batch for an HTTP POST to the gateway.

In function `d4e78smfm7fspkagvaj2`, replace `index.js` with the built file.
Keep Node.js 22, entry point `index.handler`, 256 MB, timeout 5 seconds and public access **off**.
Set `TELEMETRY_ENVIRONMENT=testing`. No database credentials, access keys or Lockbox secrets are needed. The old `storage.uploader` role and static storage keys are not needed by this telemetry path.
Save the version, then run the console test using `test-event.json`.
Rebuild fixtures when older than 24 hours: the receiver rejects stale client timestamps.

Expected response: status `202`, body `{"forwarded":3}`. Then check CHV with
`project == diplodoc-vsc` and environment `testing`; search Items by one of the fixture event IDs (`requestId`).
The batch contains activation, editor opening and a classified validation error.
Verify all three rows and the same non-null `yandexuid` before connecting real users.
The handler's 202 confirms upstream HTTP acceptance; CHV rows are the ingestion proof.

## Gateway and extension

Grant existing service account `aje26jt8j7brfphr3kk1` `functions.functionInvoker` on **this function**.
Create API Gateway in folder `b1g1j115gl75k4sqiu0m` using `api-gateway.yaml`.
The [gateway invokes the private function as the service account](https://yandex.cloud/ru/docs/api-gateway/concepts/extensions/cloud-functions).
Copy its HTTPS service URL and append `/telemetry`.

Gateway rate limiting is deferred for the initial rollout; the current gateway has no SWS profile attached.
To enable it later, attach a [Smart Web Security profile with Advanced Rate Limiter](https://yandex.cloud/ru/docs/api-gateway/concepts/extensions/sws).
The prepared rules use a global limit of 10 requests/second and 120 requests/minute per source IP; tune using actual load (shared NATs can hit the per-IP limit).
Use blocking/rate limiting without browser challenges or CAPTCHA, which the extension cannot solve.
Add the profile to `api-gateway.yaml` at the top level:

```yaml
x-yc-apigateway:
  smartWebSecurity:
    securityProfileId: YOUR_SECURITY_PROFILE_ID
```

The old gateway rate-limit extensions are [no longer supported](https://yandex.cloud/ru/docs/api-gateway/concepts/extensions/rate-limit).
The public API accepts anonymous data: validation and limits do not authenticate installations or prevent forged statistics.

Build the extension with the actual URL (replace the example):

```sh
DIPLODOC_TELEMETRY_ENDPOINT='https://YOUR_GATEWAY.apigw.yandexcloud.net/telemetry' npm run compile:ext
```

The build embeds this URL; changing the shell environment after compilation has no effect.
An empty endpoint disables collection. The endpoint cannot be set by a workspace or a document.
For automated VSIX/npm releases, set the GitHub repository **Actions variable** `DIPLODOC_TELEMETRY_ENDPOINT` to this URL. Both release workflows pass it to the build; an unset variable keeps collection disabled. Switch the function to `TELEMETRY_ENVIRONMENT=production` for the public release.
The function controls the environment; clients cannot choose a project or collector URL.

For an HTTP test (only run when ready to ingest the test events):

```sh
curl --fail-with-body 'https://YOUR_GATEWAY.apigw.yandexcloud.net/telemetry' \
  -H 'Content-Type: application/json' --data-binary @build/telemetry/test-payload.json
```

In VS Code, open the editor and search for references; after about 10 seconds, check CHV.
Then set `telemetry.telemetryLevel=off` and verify no further requests from the extension.
`error` allows classified errors only; `off`/`crash` disables these usage and error events.

## Data and analytics

The schema preserves the 17 names in `src/modules/telemetry/constants.ts` and allowlists
their dimensions and counters in `schema.ts`. Raw exception messages/stacks, documents,
paths, logins, cookies, hostnames and VS Code machine IDs are excluded.
The random installation UUID stays in VS Code globalState, is not registered for Settings Sync,
and is converted at ingress into a project-scoped UInt64 for CHV `yandexuid`.
`Users` therefore means installations, not identified people. A fresh session UUID goes into `additional.sessionId`.
Versions, OS, event timestamp and approved dimensions are available for filtering.
Errors use normal `rum_events` rows with `additional.kind=error`; this does not collect crash stacks.

Use `Name` to compare feature usage, `Users` for active installations, `Additional` for source,
file type, editor mode and action, and `ValueInteger` for the reference count (`references/find`).
Other events have integer value 1. Count rows/events for frequency; summing values across
different event names would mix frequencies with the number of references.
`md-editor/mode` is the initial mode, and `project/init` is an attempt, not successful completion.

The in-memory queue holds 100 pending events, sends up to 20 per batch every 10 seconds,
expires events after 5 minutes and makes at most 3 attempts with the original event IDs.
4xx errors other than 408/429 are not retried. Shutdown attempts one final batch.
Delivery is best effort: offline periods, overflow and shutdown may lose events; retries may
duplicate rows. Use distinct `requestId` when accurate event counts are needed.
Disabling telemetry clears pending disallowed events and aborts the current request, but cannot
recall events already received upstream.

The shared collector sees the function's egress IP, so its IP/geolocation fields describe the
function, not end users. Gateway/platform access logs can still contain source IPs.
CHV project filters are not access controls; project visibility and retention depend on the
shared service. This setup proves event ingestion, not a separately retained dataset.
For scheduled exports use the supported [YQL route](https://docs.yandex-team.ru/error-booster/),
not automation against the CHV UI API.
