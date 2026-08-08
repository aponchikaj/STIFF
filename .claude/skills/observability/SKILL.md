---
name: observability
description: "When the user wants to instrument, monitor, or debug production systems — logging, metrics, tracing, dashboards, SLOs, alerting, on-call, or incident response. Triggers: \"logging\", \"metrics\", \"tracing\", \"alerts\", \"SLO\", \"incident\", \"on-call\", \"monitoring\", \"too many alerts\", \"what happened in prod\". Covers the three pillars with honest role boundaries, structured logging schemas, RED/USE dashboards, SLO and error-budget discipline, multi-window burn-rate alerting, OpenTelemetry adoption, incident response mechanics, blameless postmortems, and cardinality cost control. For the pipeline that ships instrumented code, see devops-cicd. For security incident specifics, see appsec."
metadata:
  version: 1.0.0
---

# Observability & Incident Response

Act as a senior SRE who has run on-call for high-traffic systems and cleaned up more than one alert dumpster fire. The outcome: a system where a page means a user-facing problem exists right now, an engineer can go from alert to suspect code in minutes instead of hours, and reliability decisions (ship vs. freeze) are made with an error budget instead of vibes. Most teams do not have an observability tooling problem — they have a signal-design problem: too many metrics nobody reads, logs that can't be queried, and alerts that trained everyone to ignore them.

## Before Starting

Ask these before recommending anything. Skip questions the context already answers.

1. **Stack and scale**: What languages/frameworks, how many services, and roughly what request volume? A 3-service monolith-plus-workers setup needs a different plan than 80 microservices.
2. **Current tooling**: What's already collecting logs/metrics/traces (Datadog, Grafana stack, CloudWatch, ELK, "just console.log")? Is anything on OpenTelemetry yet? Rip-and-replace is rarely the answer.
3. **Incident pain**: What does a bad day look like — how do you find out something is broken (alert, customer email, Twitter)? How long does diagnosis typically take, and what's the current alert volume per on-call week?
4. **SLO maturity**: Do you have defined SLOs with error budgets, informal targets ("we aim for 99.9%"), or nothing? Who would consume an error budget decision — is there a leader who'd actually pause a launch over it?

## The Three Pillars — Honest Roles

Each pillar has a job. Cost structure enforces the boundaries: metrics are cheap because they aggregate; logs and traces are expensive because they don't.

| Pillar | What it is | Good for | Cost driver | Never use it for |
|---|---|---|---|---|
| Metrics | Pre-aggregated numbers over time (counters, histograms) | Alerting, trends, dashboards, SLOs | Label cardinality (unique label combos) | Per-user detail, debugging one request |
| Logs | High-cardinality event records | Investigation: what exactly happened, for whom, with what payload | Volume (bytes ingested × retention) | Alerting math, cross-service causality |
| Traces | Request-scoped spans across services | Causality: where did this request spend time, which downstream call failed | Span volume; sampling controls it | Long-term trends (sampling skews aggregates) |

Pillar selection when something is wrong:

| Question | Start with | Then |
|---|---|---|
| "Is it slow?" | Traces — find the span eating the latency | Logs on the offending service |
| "Is it broken?" | Metrics alert fires — scope the blast radius | Logs filtered by trace_id from an exemplar |
| "Why did this one user's request fail?" | Logs (search by user/request id) | Trace for the request's full path |
| "Are we trending toward trouble?" | Metrics (saturation, error rate slope) | — |

## Structured Logging

Every log line is JSON with a stable core schema. Free-text logs are write-only; structured logs are a queryable database of what happened.

Core fields every line carries:

```json
{
  "ts": "2026-08-08T14:03:21.481Z",
  "level": "error",
  "service": "checkout-api",
  "env": "prod",
  "trace_id": "4bf92f3577b34da6",
  "request_id": "req_8xk2",
  "user_id": "u_19f3",
  "event": "payment.charge_failed",
  "msg": "card declined by processor",
  "detail": { "processor": "stripe", "decline_code": "insufficient_funds", "amount_cents": 4999 }
}
```

Rules that matter:

- **`event` is a stable, dot-namespaced name** (`payment.charge_failed`), not prose. You can count, group, and alert-adjacent-query on it. `msg` is for humans; `detail` is free-form.
- **`trace_id` in every line.** This is the join key between logs and traces. Without it, "find the logs for this slow trace" is grep archaeology.
- **Log levels have contracts**, not moods:

| Level | Contract | Example |
|---|---|---|
| ERROR | Someone will eventually be paged or ticketed about this; it represents failed work | Payment failed, unhandled exception, dependency hard-down |
| WARN | Actionable later; degraded but recovered | Retry succeeded on attempt 3, cache miss fallback, deprecated API called |
| INFO | Narrative of normal operation, one line per meaningful business event | Order placed, job completed, config reloaded |
| DEBUG | Off in prod; on-demand for local/staging diagnosis | Full request payloads, loop internals |

- **No secrets or PII, scrubbed at the logger** — not by hoping developers remember. Install a redaction layer in the shared logging library that masks known key patterns (`password`, `token`, `authorization`, `card`, `ssn`, email fields) before serialization. One scrubber, enforced centrally, beats 200 code reviews.
- **Sample high-volume paths.** A health check logging INFO 10×/sec is 864k lines/day of nothing. Sample repetitive success-path logs at 1–10%; always keep 100% of ERROR and WARN.

## Default Dashboards: RED and USE

**RED per service/endpoint** — the first dashboard for any request-serving service:

| Signal | Definition | Typical panel |
|---|---|---|
| Rate | Requests/sec per endpoint | Stacked by endpoint, compare to last week |
| Errors | Failed requests/sec (5xx + business failures) | Error rate % with SLO threshold line |
| Duration | Latency histogram | p50, p95, p99 — never mean alone; means hide the users having a bad time |

**USE per resource** (hosts, DBs, queues, pools): Utilization (% busy), Saturation (queued work — run queue, connection-pool waiters, queue depth), Errors (device/driver-level failures). Saturation is the leading indicator; utilization at 80% with zero saturation is fine, 60% utilization with a growing queue is not.

Build RED for every service and USE for every shared resource before any custom dashboards. They answer 80% of "is it broken / is it slow" questions.

## SLOs and Error Budgets

- **SLI** = user-centric measurement, e.g. "% of checkout requests that return non-5xx in <500ms" or "p99 latency of search". Measure as close to the user as possible (load balancer, not app self-report).
- **SLO** = target over a window: 99.9% availability over rolling 30 days.
- **Error budget** = 1 − SLO. At 99.9%/30d you may fail 0.1% of requests — about 43 minutes of full downtime, or proportionally more partial degradation. This makes reliability spendable: budget healthy → ship fast, take risks; budget burned → freeze risky deploys, spend the sprint on reliability. That gate is the entire point — an SLO nobody acts on is a dashboard decoration.
- **Start with 1–2 SLOs on the critical user journey** (checkout, login, core API), not 40 SLOs across every service. Forty SLOs on day one means none of them gate anything. Add more only after the first two have survived a quarter and actually changed a decision.

Worked example for a checkout API:

| Element | Definition |
|---|---|
| SLI | good = requests to `/api/checkout/*` with status < 500 AND latency < 500ms, measured at the load balancer |
| SLO | 99.9% of requests good, rolling 30 days |
| Error budget | 0.1% of ~30M monthly requests = 30,000 bad requests to spend |
| Budget policy | >50% budget remaining: normal velocity. 10–50%: risky changes need canary + senior review. <10%: feature freeze, reliability work only until budget recovers |

Write the budget policy down and get it signed off before the first breach — negotiating it mid-incident always ends with the budget losing.

## Alert Design Against Fatigue

Alert on **symptoms users feel**, not causes. CPU at 90% is not a problem; users seeing errors is. Cause-based alerts (CPU, memory, disk) become tickets or dashboard panels, not pages — with rare exceptions like "disk full in <4h" where the symptom is imminent and irreversible.

The workhorse: **multi-window burn-rate alerting** on SLO error budget:

| Alert | Condition (99.9% SLO) | Meaning | Response |
|---|---|---|---|
| Fast burn | 14.4× burn rate over 1h (and 5m) | ~2% of 30d budget gone in 1 hour | Page immediately |
| Slow burn | 3× burn rate over 6h | Budget exhausts in ~10 days at this rate | Ticket, handle in business hours |

The dual window (1h AND 5m) stops a resolved spike from paging an hour later. Burn rate = observed error rate ÷ budgeted error rate; 14.4× against a 99.9% SLO means a 1.44% error rate. In Prometheus terms:

```yaml
- alert: CheckoutSLOFastBurn
  expr: >
    (sum(rate(http_requests_total{route="checkout", code=~"5.."}[1h]))
     / sum(rate(http_requests_total{route="checkout"}[1h]))) > 14.4 * 0.001
    and
    (sum(rate(http_requests_total{route="checkout", code=~"5.."}[5m]))
     / sum(rate(http_requests_total{route="checkout"}[5m]))) > 14.4 * 0.001
  labels: { severity: page }
  annotations: { runbook: "https://<wiki>/runbooks/checkout-slo" }
```

Non-negotiable rules:

- **Every alert links a runbook** with a concrete first action. If the honest response to an alert is "watch it", delete the alert.
- **Page only for now-problems** that need a human within minutes. Everything else is a ticket. Being woken at 3am for something that could wait until 10am is how teams learn to ignore pages.
- **Alert review cadence**: weekly or per on-call handoff, list every alert that fired. Any alert that fired twice without producing action gets tuned or killed. No exceptions — each ignored page lowers the response to real ones.

## Tracing Adoption Path

1. **OpenTelemetry, always.** Vendor-neutral instrumentation means backend choice (Jaeger, Tempo, Datadog, Honeycomb) stays reversible.
2. **Auto-instrument first.** OTel auto-instrumentation for your framework (HTTP server/client, DB drivers, gRPC) gets 70% of the value in an afternoon. Do not hand-write spans until this is deployed.
3. **Add manual spans at business operations** — `apply_discount`, `risk_check`, `render_invoice` — the units a human debugging thinks in. Attach business attributes (order value tier, feature flags active) as span attributes.
4. **Propagate context across queues.** Traces die at the message-queue boundary unless you inject/extract trace context in message headers. A trace that ends at "published to Kafka" answers nothing.
5. **Sample deliberately**: head-based 1–10% for baseline volume, plus tail-based sampling that keeps 100% of traces containing errors or p99+ latency. Slow and broken requests are exactly the ones you'll search for.

Sampling starting points by volume:

| Traffic | Head sample | Tail rules (via OTel Collector) |
|---|---|---|
| <100 req/s | 100% | None needed yet |
| 100–1k req/s | 10% | Keep all error traces |
| >1k req/s | 1% | Keep all errors + latency > p99 threshold |

Tail sampling requires routing all spans of a trace to the same collector instance (load-balancing exporter by trace_id) — plan for that before turning it on, not after traces arrive half-empty.

## Incident Response Mechanics

Severity ladder — argue about definitions before the incident, never during:

| Sev | Definition | Response | Comms |
|---|---|---|---|
| 1 | Critical user journey down or data loss occurring | Page, all-hands, IC assigned, drop everything | Status update every 30 min, exec + customer-facing |
| 2 | Major degradation, workaround exists or subset of users | Page on-call, IC if >1 responder | Update every 60 min, internal channel |
| 3 | Minor degradation, no immediate user harm | Ticket, business hours | Daily until resolved |
| 4 | Cosmetic / internal-only | Backlog | None |

Roles: the **incident commander** coordinates, decides, and communicates — and does not debug. **Investigators** debug and report findings to the IC. One person doing both is how updates stop and rabbit holes go unchallenged. First investigation question is always **"what changed?"** — deploys, feature flags, config, infra changes in the last few hours explain most incidents; check the change log before theorizing. Then correlate: metrics scope the blast radius, trace exemplars from the affected window localize the failing hop, logs by trace_id give the exact error.

Use `assets/incident-runbook-template.md` as the fill-ready template for the team's runbook: severity table, role assignments, comms cadence, investigation checklist, and postmortem structure.

## Blameless Postmortems

Sev1/Sev2 always get one, within 5 business days. Structure: timeline (detection → diagnosis → mitigation → resolution, with timestamps), impact quantified (users, requests, revenue, budget consumed), **contributing factors — plural** ("the deploy" plus "no canary" plus "the alert that would have caught it was silenced"), and action items each with an owner and a due date. "Root cause: human error" is banned; humans err at a constant rate, systems determine whether the error propagates. Track action-item completion in the same system as normal work and review open ones monthly — postmortems whose action items rot are theater, and everyone notices.

## Cardinality Economics

Metric cost = number of unique label combinations, not number of data points. A latency histogram labeled by `endpoint` (50) × `status` (5) × `region` (4) = 1,000 series — fine. Add `user_id` (1M users) and it is 1 billion series — that is a five-figure monthly bill and a melted metrics backend from one label.

| Label candidate | Cardinality | Verdict |
|---|---|---|
| `status_class` (2xx/4xx/5xx) | 3 | Yes |
| `endpoint` (route template, not raw URL) | 10–100 | Yes |
| `region`, `env`, `version` | <20 each | Yes |
| Raw URL path (contains ids) | Unbounded | No — normalize to route template |
| `user_id`, `request_id`, `session_id` | Unbounded | Never — logs/traces only |
| `customer` for top-tier accounts | Bounded allowlist (~10) | Acceptable with an explicit cap |

Rules: labels must be bounded, low-cardinality enums; anything unbounded belongs in logs and traces, which are built for high cardinality. If someone asks "can we break this metric down by customer?", the answer is a log-derived query or a trace search — never a per-customer label. Set a series budget per service (e.g. 10k series) and alert on the backend's own series-count metric; cardinality regressions ship silently in ordinary PRs.

## Workflow

1. **Assess** using the Before Starting answers. Identify the sharpest pain: usually either "we find out from customers" (no symptom alerting) or "alerts are noise" (fatigue) or "diagnosis takes hours" (no trace/log correlation).
2. **Standardize logging first** — it is the cheapest win. Ship the JSON schema above in a shared logger with redaction; migrate services opportunistically, new services mandatorily.
3. **Stand up RED dashboards** per service and USE for shared resources, from auto-instrumented metrics.
4. **Define 1–2 SLOs** on the critical user journey with the team and a leader who will honor the budget gate. Document the SLI measurement point.
5. **Replace cause alerts with burn-rate alerts.** Implement fast-burn page + slow-burn ticket. Demote every existing cause-based page to ticket/dashboard unless it has paged usefully in the last quarter.
6. **Roll out OpenTelemetry tracing**: auto-instrumentation → queue context propagation → business spans → tail sampling for errors and slow requests.
7. **Install incident mechanics**: adopt the severity ladder, IC/investigator roles, and the runbook template; fill runbooks for the top 5 alerts.
8. **Close the loop**: weekly alert review (fired-without-action → tune or kill), postmortems for Sev1/2 with tracked action items, quarterly SLO review against actual user pain.

## Common Mistakes

1. **Alerting on causes (CPU 90%, memory 80%)** → pages that need no action. Fix: alert on SLO burn rate and user-visible symptoms; demote resource alerts to dashboards or tickets with a saturation rationale.
2. **Per-user or per-request labels on metrics** → cardinality explosion and a shocking bill. Fix: unbounded identifiers go to logs/traces; metrics keep bounded enums only.
3. **Free-text logs without trace_id** → grep archaeology during incidents. Fix: JSON schema with stable `event` names and trace_id in every line, enforced by the shared logger.
4. **40 SLOs at once** → none gate anything, all are ignored. Fix: 1–2 SLOs on the critical journey; expand only after they change a real decision.
5. **Keeping alerts that fire without action** → trained ignorance; the real page gets slept through. Fix: standing review — twice fired without action means tune or delete.
6. **Traces that die at the queue boundary** → causality lost exactly where async bugs live. Fix: propagate trace context in message headers; verify with an end-to-end trace through the queue.
7. **Sampling traces uniformly** → the errors and p99s you need are the ones discarded. Fix: tail-based sampling keeping 100% of error/slow traces over the head-sampled baseline.
8. **Postmortems ending in "human error" with orphaned action items** → same incident in 6 months. Fix: contributing factors (plural), owner + date on every item, monthly review of open items.

## Output Format

Deliver, in order:

1. **Current-state diagnosis** — 3–5 bullets naming the sharpest gaps against the frameworks above.
2. **Prioritized plan** — the workflow steps that apply, sequenced, each with effort (S/M/L) and the pain it removes.
3. **Concrete artifacts** for the immediate step: log schema for their stack, SLO definitions with SLI measurement points, burn-rate alert rules in their tooling's syntax, or a filled runbook from `assets/incident-runbook-template.md` — whichever the situation calls for.
4. **What not to do yet** — one short list of deferrals (more SLOs, custom dashboards, vendor migration) so scope stays tight.

Keep recommendations executable this sprint; name specific files, alert thresholds, and owners rather than principles.
