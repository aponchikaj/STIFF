# Incident Runbook — <Service / System Name>

> Fill every `<placeholder>`. Delete guidance blockquotes once filled. Review quarterly; last reviewed: `<date>` by `<name>`.

## 1. Service Overview

- **Service**: `<name>` — `<one-line purpose>`
- **Criticality**: `<tier 1/2/3>` — user journeys affected: `<checkout, login, ...>`
- **Owning team**: `<team>` — Slack: `#<channel>` — On-call rotation: `<PagerDuty/Opsgenie schedule link>`
- **Dashboards**: RED: `<link>` | USE/resources: `<link>` | SLO: `<link>`
- **Key dependencies**: `<db, cache, queue, third-party APIs>`

## 2. Severity Levels

| Sev | Definition | Examples for this service | Response expectation | Who is paged |
|---|---|---|---|---|
| 1 | Critical journey down or data loss occurring | `<e.g. checkout 5xx >5%, payments not processing>` | Immediate, 24/7. IC assigned within 15 min. Drop all other work. | Primary on-call + secondary + `<manager/escalation>` |
| 2 | Major degradation; workaround exists or subset of users affected | `<e.g. p99 >3s sustained, one region down>` | Immediate during business hours; page after hours only if worsening. | Primary on-call |
| 3 | Minor degradation; no immediate user harm | `<e.g. background job lag, elevated retries>` | Next business day ticket. | Nobody paged |
| 4 | Cosmetic or internal-only | `<e.g. staging broken, log noise>` | Backlog. | Nobody |

> Escalation rule: if severity is ambiguous, pick the higher one. Downgrading later is free; late upgrades cost trust.

## 3. Roles

| Role | Responsibility | Assigned to (this incident) |
|---|---|---|
| Incident Commander (IC) | Coordinates, decides, communicates. Does NOT debug. Declares severity, assigns tasks, calls resolution. | `<name>` |
| Investigator(s) | Debug, test hypotheses, report findings to IC every check-in. | `<names>` |
| Comms lead (Sev1) | Writes status updates, handles stakeholder/customer questions so investigators don't. | `<name>` (IC may double-hat on small incidents, never on Sev1) |
| Scribe (optional) | Timestamps events, decisions, and actions in the incident channel. | `<name>` |

> First responder becomes interim IC until relieved. Say it explicitly in the channel: "I am IC."

## 4. Communication Cadence

| Sev | Update frequency | Channel(s) | Audience |
|---|---|---|---|
| 1 | Every 30 min, even if "no change" | `#<incident-channel>`, status page `<link>`, exec thread | Company + customers |
| 2 | Every 60 min | `#<incident-channel>` | Engineering + affected teams |
| 3 | Daily until resolved | Ticket comments | Owning team |

Status update template (paste and fill):

```
[Sev<1/2> | <service> | Update <n> | <HH:MM TZ>]
Impact: <who/what is affected, quantified if possible>
Status: <investigating / mitigating / monitoring / resolved>
What we know: <1-3 bullets>
Next update: <HH:MM>
IC: <name>
```

## 5. Investigation Checklist

Work top to bottom. "What changed?" resolves most incidents fastest.

1. [ ] **Declare**: open incident channel `#inc-<date>-<slug>`, state severity and IC, start the timeline.
2. [ ] **Scope the blast radius** (metrics): which endpoints/regions/user segments? Error rate and latency vs. 1h/24h/7d ago. Dashboard: `<link>`
3. [ ] **What changed in the last 4 hours?**
   - [ ] Deploys: `<deploy log/link>` — roll back first, diagnose after, if timing correlates.
   - [ ] Feature flags: `<flag dashboard link>`
   - [ ] Config/infra changes: `<terraform/config log link>`
   - [ ] Dependency/vendor status: `<status pages: cloud, payment, CDN, ...>`
4. [ ] **Localize** (traces): pull trace exemplars from the affected window; find the span where latency/errors concentrate. Query: `<saved trace query link>`
5. [ ] **Drill in** (logs): filter by trace_id from a bad exemplar; read the exact error. Saved search: `<link>`
6. [ ] **Check saturation**: connection pools, queue depth, DB locks, disk, memory. Dashboard: `<link>`
7. [ ] **Mitigate before root-causing**: rollback, flag off, failover, scale up, shed load. Known levers for this service:
   - `<lever 1: e.g. disable recommendation sidebar via flag X>`
   - `<lever 2: e.g. fail over reads to replica with runbook Y>`
8. [ ] **Verify recovery**: SLI back to normal for `<15/30>` min before declaring resolved; keep monitoring window open.
9. [ ] **Close out**: post final update, thank responders, schedule postmortem (required for Sev1/2), keep the channel until the postmortem is done.

## 6. Known Failure Modes

| Symptom | Likely cause | First action | Verified by |
|---|---|---|---|
| `<e.g. 5xx spike on /checkout>` | `<e.g. payment provider timeout>` | `<e.g. enable cached-quote fallback flag>` | `<name, date>` |
| `<symptom>` | `<cause>` | `<action>` | `<name, date>` |

> Every alert that pages for this service must map to a row here or link its own runbook.

## 7. Postmortem Structure

Complete within 5 business days of a Sev1/2. Blameless: name systems and conditions, not people. "Human error" is not a finding.

```
# Postmortem: <incident title> — <date>

## Summary
2-3 sentences: what broke, user impact, duration, how it was resolved.

## Impact
- Duration: <detection HH:MM> → <resolution HH:MM> (<total>)
- Users/requests affected: <number or %>
- Error budget consumed: <% of 30d budget>
- Revenue/business impact: <estimate or "none">

## Timeline (all times <TZ>)
- HH:MM — <triggering change deployed / condition began>
- HH:MM — <first alert or report> (detection gap: <time from start>)
- HH:MM — <incident declared, Sev, IC>
- HH:MM — <key finding or decision>
- HH:MM — <mitigation applied>
- HH:MM — <resolved>

## Contributing Factors (plural — there is never just one)
1. <e.g. deploy lacked canary for this code path>
2. <e.g. alert on this SLI was silenced during a prior migration>
3. <e.g. runbook lever was outdated and failed>

## What Went Well / What Went Poorly
- Well: <detection, tooling, decisions that worked>
- Poorly: <gaps in signal, process, docs>

## Action Items (owner + due date required; no owner = delete the item)
| # | Action | Owner | Due | Ticket | Status |
|---|---|---|---|---|---|
| 1 | <prevent: fix the systemic gap> | <name> | <date> | <link> | open |
| 2 | <detect: alert/SLI improvement> | <name> | <date> | <link> | open |
| 3 | <mitigate: faster lever next time> | <name> | <date> | <link> | open |
```

> Review open action items monthly in `<forum/meeting>`. Postmortems with rotting action items are theater.
