# Hosting and what it costs

**Budget ceiling: $750/month.** Everything below is sized to sit well under it,
and the last section names the four things that would break it.

There is no live streaming. Every attempt is a recording, uploaded when the
clock stops. That single decision is what makes these numbers small, so the
arithmetic is written out rather than asserted.

---

## The two rules that decide the bill

**1. Bytes never pass through the Nest app.** The browser asks the API for a
presigned URL and `PUT`s the file straight to object storage. The API sees a
few hundred bytes of JSON per upload and never the media.

Routing a season's uploads through Render instead would cost bandwidth on top
of a plan sized for JSON, and would pin an instance's memory on file buffers.
It is also the difference between "add another instance" and "rewrite the
upload path" when the game gets busy.

**2. The phone records at delivery bitrate.** `MediaRecorder` is capped at
720p / ~1.5 Mbps with a hard duration limit per tier. The file uploaded is the
file served.

This deletes an entire stage. No transcoding service, no second stored copy,
and about a third less upload volume. At the scale below, an AWS MediaConvert
stage would have been roughly **$29 per season** on its own — for a file the
phone could simply have produced correctly in the first place.

**720p at 1.5 Mbps = 11 MB per minute.** Every number below comes from that.

---

## What a 1,000-player season actually moves

The cut lines scale with the field: 1,000 → 200 → 20.

| Day | Players | Cap | Media | Volume |
|---|---|---|---|---|
| 1 · Qualifier | 1,000 | photo or ≤60s | 500 photos @ 400 KB + 500 clips @ 11 MB | **5.7 GB** |
| 2 · Nerve | 200 | ≤3 min | 200 × 33 MB | **6.6 GB** |
| 3 · Final | 20 | ≤5 min | 20 × 55 MB | **1.1 GB** |
| | | | **uploaded** | **≈ 13.4 GB** |

Stored, with thumbnails and a 90-day retention window: **≈ 50 GB**.

### Per 1,000 uploads, by kind

Useful as a unit rate for any other shape of season.

| 1,000 uploads of… | Volume |
|---|---|
| photos (client-resized) | 0.4 GB |
| ≤60s clips | 11 GB |
| ≤3 min clips | 33 GB |
| ≤5 min clips | 55 GB |

### Delivery is the variable, not upload

~1,220 clips get published for voting. What they cost depends entirely on how
many people watch them, which nobody knows yet — so here are three worlds.
Assumes ~1 minute actually watched per view.

| Scenario | Views / clip | Total views | Egress |
|---|---|---|---|
| Light | 20 | 24,400 | 268 GB |
| **Medium** | **60** | **73,200** | **805 GB** |
| Viral | 300 | 366,000 | 4.0 TB |

---

## The same season on AWS vs on R2

This is the comparison worth having, because it is not close.

| | AWS (S3 + CloudFront) | Cloudflare R2 |
|---|---|---|
| Storage, 50 GB | $0.023/GB → **$1.15** | $0.015/GB → **$0.75** |
| Upload ops | ~$0.01 | ~$0.03 |
| Read ops | included in requests | $0.36/M → **$0.26** |
| Request charges | $0.010/10k → **$0.73** | — |
| **Egress, 805 GB** | **$0.085/GB → $68.43** | **$0 — R2 does not charge egress** |
| Transcoding | $0 (we record at bitrate) | $0 |
| **Medium season total** | **≈ $70** | **≈ $1** |
| Light season | ≈ $24 | ≈ $1 |
| Viral season (4 TB) | **≈ $344** | **≈ $2** |

The gap is one line item. AWS charges to hand the file back; R2 does not. For a
workload that is almost entirely "serve a video someone uploaded", that line is
the whole bill.

**Do not split them.** S3 for storage with Cloudflare in front is the worst of
both — cross-cloud egress out of S3 is billed at $0.09/GB before Cloudflare
ever sees the byte. R2 end to end, or AWS end to end.

**Latency note.** Cloudflare's network reaches the Caucasus directly, which
matters more here than in most markets. Measure it on Magti and Silknet before
Level 6 rather than trusting a map — the roadmap already insists on real
Georgian network tests, and this is the same discipline applied to delivery.

Presigned-URL uploads work identically on both, so this choice is reversible if
the measurement says otherwise.

---

## The services, and what each is for

| Layer | Service | Why this one |
|---|---|---|
| 5 × Next.js apps | **Vercel Pro** | `frontend`, `staff`, `admin`, `game`, later `game-admin` — all on one seat. 1 TB transfer included, which is plenty once video is served from R2 instead |
| NestJS API | **Render** | Vertical until Redis lands, then horizontal. No Docker, which rules out the cheap-VPS route by house rule |
| Postgres | **Supabase** | Already in Frankfurt, already holds the gallery archive, migrations are built around it |
| Media | **Cloudflare R2** | Zero egress. The table above |
| CDN / DNS / WAF | **Cloudflare** | Free tier covers it; Pro during a season for the analytics and rate rules |
| Redis | **Upstash** | Not optional — see below |
| Email | **Resend** | 50k/month on Pro is far past what a season sends |
| AI | **Anthropic API** | Level 6 only. Nothing before it |

### Redis is a prerequisite, not an upgrade

The API cannot run more than one instance today, for three reasons found in the
code:

- `configure-app.ts` wires a plain `IoAdapter`. With two instances, a staff chat
  message sent to one never reaches a client connected to the other.
- `ThrottlerModule.forRoot` has no storage configured, so limits are per-process
  memory. Three instances turn a 5-per-minute login limit into 15.
- Six `@Cron` jobs have no leader election, so every instance runs every job.
  `abandonedCartReminders` would mail the same person once per instance.

One Upstash instance closes all three for about $10/month. Until it exists,
`instances = 1` and the only way up is a bigger box.

---

## The bill

### Steady state — shop live, no season running

| | $/month |
|---|---|
| Vercel Pro | 20 |
| Render — Pro workspace $25 + Standard instance $25 | 50 |
| Supabase Pro + Small compute (less $10 credit) | 30 |
| Cloudflare free + R2 | 1 |
| Upstash Redis | 10 |
| Resend Pro | 20 |
| **Total** | **≈ $131** |

### Season month — 1,000 players, medium viewing, no AI yet

| | $/month |
|---|---|
| Vercel Pro + overage | 30 |
| Render — Pro workspace $25 + Pro instance $85 | 110 |
| Supabase Pro + Medium compute (less credit) | 75 |
| Cloudflare Pro + R2 | 22 |
| Upstash Redis | 10 |
| Resend Pro | 20 |
| **Total** | **≈ $267** |

Uploads bypass the API entirely, so the Render step up is for the clock polling
and the review queue, not for media. It is a generous size, not a forced one.

### Season month with the AI running (Level 6)

Add **$50–250**, depending on how much of the Tier A / B / C cascade escalates.
That band is wide because it is genuinely unknown until shadow mode runs — it
is the roadmap's "cost per verified attempt", and it is the number to measure
first at Level 7 rather than estimate now.

**Ceiling case: ≈ $520/month. Headroom against $750: ~$230.**

---

## What would actually break the budget

Four things, in order of likelihood.

1. **Serving video through Vercel or Render instead of R2.** Vercel bills
   $0.15/GB past 1 TB; a medium season's 805 GB routed through the app would be
   most of a month's budget for bytes R2 hands over free. This is what rule 1
   exists to prevent.
2. **Staying on Cloudinary.** $99/month on Plus, $249 on Advanced, for a job R2
   does for about $1. `uploads.service.ts` already hides the provider behind one
   interface, so this is a small change with a large number attached.
3. **Choosing AWS for media and then going viral.** $344 against R2's $2.
   Survivable once; not a thing to design around.
4. **Supabase compute climbing.** Micro → Medium is $10 → $60; Large is $110 and
   XL $210. Watch it during a season and size back down afterwards — it is a
   per-month toggle, not a commitment.

None of these is a surprise that arrives on its own. Each is a decision.

---

*Prices are the public rates as of September 2026 and move. Re-check before
committing to anything annual — Hetzner raised cloud prices 113–175% in June
2026, which is the kind of thing this table cannot predict.*
