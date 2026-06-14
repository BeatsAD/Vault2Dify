# Connection Troubleshooting

English | [中文](CONNECTION_TROUBLESHOOTING_ZH.md)

Use this guide when `Vault2Dify` fails during connection testing, knowledge-base refresh, or file sync.

## Quick Check Order

| Order | Check | Notes |
| --- | --- | --- |
| 1 | API Key | Confirm it is present, complete, and has no extra spaces or line breaks. |
| 2 | Dify service URL | Enter the Dify service URL reachable from this Obsidian device. The plugin normalizes omitted `http://`, `/v1`, and `/v1/datasets`. |
| 3 | Browser access | Open `your URL + /v1/datasets` in a browser. |
| 4 | Response content | JSON usually means the URL is close; HTML usually means the URL or port is wrong. |
| 5 | Permissions | If the URL works but no knowledge bases appear, check workspace and knowledge-base permissions. |
| 6 | Network path | Check ports, firewall, Docker mapping, NAS network, Tailscale, and reverse proxy rules. |
| 7 | Plugin retest | Return to settings and click `Test connection`. |

## Error Reference

| Error message | Status | Likely cause | What to do | How to confirm |
| --- | --- | --- | --- | --- |
| Please fill in Dify API Key and Dify service URL first. | `missing_config` | Required connection fields are incomplete. | Fill the API key and reachable Dify service URL, then test again. | Status moves away from `Pending setup` and shows success or a specific failure. |
| API Key is invalid. Please check whether the key is correct. | `auth_failed` | Dify returned 401. | Copy the Dify Knowledge Base API Key again; remove extra whitespace; confirm the key belongs to this Dify instance. | The invalid-key message disappears. |
| API Key does not have knowledge-base access. Please check Dify permissions. | `permission_denied` | Dify returned 403. | Confirm the key belongs to the right workspace and has knowledge-base permissions. | `Test connection` can load knowledge bases. |
| Dify Knowledge Base API was not found. Check the Dify service URL, port, and reverse proxy forwarding. | `not_found` | Dify returned 404 for the API path. | Use a reachable service URL such as `http://dify-host.example.test:5000`, or a NAS Tailscale URL such as `http://tailnet-device.example.test:5000`; check reverse proxy forwarding for `/v1`. | Browser access to `URL + /v1/datasets` no longer returns 404. |
| Current API path is incompatible. Upgrade to the latest build and retry. | `path_mismatch` | Dify document API path did not match the plugin compatibility layer. | Confirm the plugin is on the latest build; retry `Test connection`, then sync; if it persists, enable debug logs and report Dify version plus error details. | Document sync no longer reports path incompatibility. |
| Dify returned too many requests. Lower concurrent uploads or retry later. | `rate_limited` | Dify returned 429. | Lower concurrent uploads, retry later, or sync large folders in batches. | Sync no longer reports rate limiting and failed counts decrease. |
| Dify service error. Check Dify containers, service logs, or reverse proxy. | `server` | Dify returned 5xx. | Check Dify service health, container logs, and reverse proxy upstream settings. | `/v1/datasets` no longer returns 5xx and plugin testing succeeds. |
| Request timed out. Confirm that this device can reach the Dify service URL. | `timeout` | The request did not complete within the plugin's internal timeout. | Confirm network reachability; check Dify load, ports, firewall, Tailscale, and reverse proxy; for large syncs, lower concurrent uploads to `2 files` or sync in smaller batches. | Tests return results and sync no longer times out frequently. |
| Network connection failed. Check URL, port, firewall, Docker mapping, or reverse proxy. | `network` | The Obsidian device cannot connect to the target address. | Check IP, domain, port, Docker mapping, firewall, routing, Tailscale, and reverse proxy service. | Browser can open `URL + /v1/datasets` and plugin testing no longer shows network failure. |
| The current address did not return the Dify Knowledge Base API. Check whether the URL and port point to Dify. | `unexpected_response` | The request reached a web page, login page, NAS admin page, Dify frontend page, or another non-Dify API response. | Use the Dify service root URL; do not use a NAS admin URL; confirm the port and reverse proxy return Dify API JSON. | The unexpected-response message disappears and testing shows knowledge bases or a permission error. |
| Connection failed. Check Dify configuration and retry. | `unknown` | The plugin could not classify the failure. | Follow the quick checks for key, URL, port, and proxy; temporarily enable debug logs; retest and inspect the Obsidian developer console. | A more specific error appears, or testing succeeds. |

## URL Rules

| Type | Example | Recommended | Notes |
| --- | --- | --- | --- |
| Dify service URL | `http://dify-host.example.test:5000` | Yes | Common for LAN, NAS, and Docker deployments. |
| NAS + Tailscale | `http://tailnet-device.example.test:5000` | Yes | Use a tailnet device hostname or documented example host plus the mapped Dify port. |
| Dify HTTPS domain | `https://dify.example.com` | Yes | Suitable for public reverse proxy or Dify Cloud. |
| Pasted `/v1` endpoint | `http://dify-host.example.test:5000/v1` | Accepted | The plugin normalizes known Dify suffixes, but the service URL is clearer. |
| Pasted `/v1/datasets` endpoint | `http://dify-host.example.test:5000/v1/datasets` | Accepted | The plugin normalizes this known endpoint to the service URL. |
| NAS admin page | `https://nas-admin.example.test/admin` | No | Usually returns HTML, not the Dify Knowledge Base API. |
| Docker-internal address | `http://api:5001` | No | The Obsidian device usually cannot access container-internal addresses. |
| Remote `localhost` | `http://localhost:5000` | Usually no | Use only when Dify and Obsidian run on the same computer. |

## Browser Verification

| Browser result | Meaning | Next step |
| --- | --- | --- |
| JSON response | The URL is likely correct. | If the plugin still fails, check API key and knowledge-base permissions. |
| HTML page | The address or port points to a web service. | Check whether it is a NAS admin page, Dify frontend, or wrong proxy target. |
| 404 | The API path does not exist. | Check the service URL, port, and reverse proxy forwarding for `/v1`. |
| 401 | The URL may be routed to Dify correctly. | Confirm the plugin API key is correct. |
| 403 | The service is reachable but permissions are insufficient. | Check key permissions and workspace. |
| Cannot connect | The network path is unreachable. | Check IP, domain, port, firewall, Docker mapping, Tailscale, and proxy. |

## Sync Failure Checks

| Symptom | Check first | Action |
| --- | --- | --- |
| Whole sync fails | Click `Test connection`. | If testing fails, follow the error table above. |
| Some files fail | Check `Recent failed files`. | Use the failure reason to inspect permissions, network, timeout, or rate limiting. |
| Many files fail | Concurrency, rate limits, service load. | Lower concurrent uploads and sync large folders in batches. |
| Test succeeds but sync fails | Mapping and write permissions. | Confirm the path mapping is enabled and target knowledge bases are writable. |

## When to Enable Debug Logs

| Scenario | Recommendation |
| --- | --- |
| The error stays generic. | Enable debug logs and inspect lower-level response details. |
| Browser verification works but the plugin still fails. | Enable debug logs and compare the plugin's actual request URL. |
| NAS, Docker, or reverse proxy routing is complex. | Enable debug logs to confirm requests reach the Dify API. |
| You need to report an issue. | Include relevant logs, but never publish API keys or sensitive note content. |
