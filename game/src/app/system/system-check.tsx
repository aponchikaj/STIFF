"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Icon, ButtonIcon } from "@/components/icon";
import { Button, Dialog, Display, Hearts, Label, Panel, Stat } from "@/components/ui";
import { ApiError, gameApi } from "@/lib/api";
import { BUTTON_ICON_NAMES, ICON_NAMES } from "@/lib/icons";
import { useRules } from "@/lib/queries";
import { formatClock, formatNumber } from "@/lib/utils";

/* ---------------------------------------------------------------- probes */

/**
 * One API route, called for real.
 *
 * `retry: false` throughout: this page is diagnosing whether the API
 * answers, so a retry would only hide a failure behind three seconds of
 * spinner and then report the same thing.
 */
function Probe({
  name,
  method,
  run,
}: {
  name: string;
  method: string;
  run: () => Promise<unknown>;
}) {
  const query = useQuery({
    queryKey: ["probe", name],
    queryFn: run,
    retry: false,
    staleTime: 0,
  });

  const status = query.isPending
    ? { text: "…", tone: "text-ink-faint" }
    : query.isError
      ? query.error instanceof ApiError && query.error.isUnauthorized
        ? // A 401 is a *passing* result for an authenticated route: the
          // route exists and the guard works. Only a 5xx or a network
          // failure means something is actually broken.
          { text: "401 AUTH", tone: "text-caution" }
        : {
            text: query.error instanceof ApiError ? `${query.error.status}` : "ERR",
            tone: "text-danger",
          }
      : { text: "OK", tone: "text-good" };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-blue-dim/40 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.08em] text-ink-faint">
          {method}
        </span>
        <span className="truncate font-mono text-[11px] text-ink-muted">{name}</span>
      </div>
      <span className={`shrink-0 font-pixel text-[9px] ${status.tone}`}>{status.text}</span>
    </div>
  );
}

/* ----------------------------------------------------------------- page */

export function SystemCheck() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const rules = useRules();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-14 px-4 py-16">
      <header className="flex flex-col gap-3">
        <Display size="title">System check</Display>
        <p className="font-body text-body-sm leading-[18px] text-ink-muted">
          Tokens, icons and a live probe of the API. Not a designed screen —
          open it when something looks wrong.
        </p>
      </header>

      {/* ------------------------------------------------------- typography */}
      <section className="flex flex-col gap-5">
        <Label>Typography</Label>
        <Panel scanlines={false} className="flex flex-col gap-6 p-6">
          <div>
            <p className="mb-2 font-body text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              Hero / display — 32/28, PPNeueBit-Bold
            </p>
            <Display size="hero">HAND IT IN</Display>
          </div>
          <div>
            <p className="mb-2 font-body text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              Pixel — Press Start 2P, buttons and HUD
            </p>
            <p className="font-pixel text-[12px] uppercase leading-5 tracking-[0.08em] text-ink">
              LEADERBOARD
            </p>
          </div>
          <div>
            <p className="mb-2 font-body text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              Body — 16/20, Helvetica Neue
            </p>
            <p className="max-w-prose font-body text-body text-ink-muted">
              Three days, three rungs. The server draws your task, the clock
              starts when you accept it, and what you hand in is judged by the
              people watching.
            </p>
          </div>
          <div>
            <p className="mb-2 font-body text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              Caption — 12/16
            </p>
            <Label>Day 2 · Tier 3 · 30 minutes</Label>
          </div>
          <p className="border-t border-blue-dim/40 pt-4 font-body text-[10px] leading-4 text-caution">
            If the hero line above looks identical to the pixel line,
            PPNeueBit is not installed and the stack has fallen through to
            Press Start 2P. See public/fonts/README.md.
          </p>
        </Panel>
      </section>

      {/* ----------------------------------------------------------- colour */}
      <section className="flex flex-col gap-5">
        <Label>Colour — nothing without blur</Label>
        <div className="flex flex-wrap gap-6">
          {[
            { name: "ffffff", className: "bg-bone shadow-[var(--glow-bone)]" },
            { name: "01a3ff", className: "bg-blue shadow-[var(--glow-blue-lg)]" },
            { name: "01e7ff", className: "bg-cyan shadow-[var(--glow-cyan-lg)]" },
            { name: "ff4d5e", className: "bg-heart shadow-[var(--glow-heart)]" },
            { name: "ffc227", className: "bg-coin shadow-[var(--glow-coin)]" },
          ].map((swatch) => (
            <div key={swatch.name} className="flex flex-col items-center gap-3">
              <div className={`size-16 ${swatch.className}`} />
              <span className="font-pixel text-[9px] text-ink-muted">{swatch.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- effects */}
      <section className="flex flex-col gap-5">
        <Label>CRT</Label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel scanlines className="flex h-28 items-center justify-center">
            <span className="font-pixel text-[10px] text-ink">SCANLINES</span>
          </Panel>
          <div className="crt-roll crt-vignette flex h-28 items-center justify-center border border-blue frame-notch">
            <span className="font-pixel text-[10px] text-ink">ROLL + VIGNETTE</span>
          </div>
          <div className="flex h-28 items-center justify-center border border-blue frame-notch">
            <span className="chromatic font-pixel text-[10px] text-ink">CHROMATIC</span>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- primitives */}
      <section className="flex flex-col gap-5">
        <Label>Primitives</Label>
        <Panel scanlines={false} className="flex flex-col gap-7 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button marker>PLAY</Button>
            <Button variant="quiet">SETTINGS</Button>
            <Button variant="danger">DECLINE</Button>
            <Button variant="coin">BUY · 40</Button>
            <Button loading>SENDING</Button>
            <Button disabled>LOCKED</Button>
          </div>

          <div className="flex flex-wrap items-center gap-8">
            <Hearts remaining={2} total={3} />
            <Stat icon="opal" value={formatNumber(1240)} label="Coins" tone="coin" />
            <Stat icon="star" value={formatNumber(880)} label="Nerve" tone="cyan" />
            <Stat icon="trophy" value="#7" label="Rank" />
            <Stat value={formatClock(1845)} label="Clock" tone="cyan" />
          </div>

          <div>
            <Button variant="quiet" size="sm" onClick={() => setDialogOpen(true)}>
              Open dialog
            </Button>
          </div>
        </Panel>
      </section>

      {/* ------------------------------------------------------------ icons */}
      <section className="flex flex-col gap-5">
        <Label>Icons — {ICON_NAMES.length} glyphs</Label>
        <Panel scanlines={false} className="p-6">
          <div className="grid grid-cols-4 gap-x-4 gap-y-7 sm:grid-cols-6 md:grid-cols-8">
            {ICON_NAMES.map((name) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <Icon name={name} size="md" />
                <span className="text-center font-body text-[9px] leading-3 text-ink-faint">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Label>Button faces — {BUTTON_ICON_NAMES.length}</Label>
        <Panel scanlines={false} className="p-6">
          <div className="flex flex-wrap items-center gap-8">
            {BUTTON_ICON_NAMES.map((name) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <ButtonIcon name={name} size="xl" />
                <span className="font-body text-[9px] text-ink-faint">{name}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* -------------------------------------------------------------- grid */}
      <section className="flex flex-col gap-5">
        <Label>Grid — 4 / 8 / 12 columns, 16px gutter</Label>
        <div className="grid-stiff">
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              className="h-14 border border-blue-dim bg-blue/5 last:border-cyan"
            />
          ))}
        </div>
        <p className="font-body text-[10px] text-ink-faint">
          Resize the window: 4 columns below 600px, 8 to 905px, 12 above.
          Columns past the count wrap to the next row.
        </p>
      </section>

      {/* --------------------------------------------------------------- API */}
      <section className="flex flex-col gap-5">
        <Label>API</Label>
        <Panel scanlines={false} className="p-6">
          <p className="mb-4 font-body text-[10px] leading-4 text-ink-faint">
            Live calls against{" "}
            <span className="font-mono text-ink-muted">
              {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}
            </span>
            . <span className="text-caution">401 AUTH</span> is a pass — the
            route exists and its guard works. Red is a real failure.
          </p>

          <Probe name="/game/health" method="GET" run={gameApi.health} />
          <Probe name="/game/rules" method="GET" run={gameApi.rules} />
          <Probe name="/game/season" method="GET" run={gameApi.season} />
          <Probe name="/game/tasks" method="GET" run={() => gameApi.tasks()} />
          <Probe name="/game/feed" method="GET" run={() => gameApi.feed({ limit: 1 })} />
          <Probe
            name="/game/leaderboard"
            method="GET"
            run={() => gameApi.leaderboard({ pageSize: 1 })}
          />
          <Probe name="/game/shop" method="GET" run={() => import("@/lib/api").then((m) => m.shopApi.list())} />
          <Probe name="/game/wars" method="GET" run={() => import("@/lib/api").then((m) => m.warsApi.list())} />
          <Probe
            name="/game/reports/reasons"
            method="GET"
            run={() => import("@/lib/api").then((m) => m.reportsApi.reasons())}
          />
          <Probe name="/game/me" method="GET" run={gameApi.dashboard} />
          <Probe name="/game/enrolments/me" method="GET" run={gameApi.myEnrolment} />
          <Probe
            name="/game/assignments/current"
            method="GET"
            run={gameApi.currentAssignment}
          />
          <Probe name="/game/attempts/mine" method="GET" run={gameApi.myAttempts} />
          <Probe name="/game/leaderboard/me" method="GET" run={gameApi.standing} />
          <Probe
            name="/game/votes/open"
            method="GET"
            run={() => import("@/lib/api").then((m) => m.votingApi.open())}
          />
          <Probe
            name="/game/clans/mine"
            method="GET"
            run={() => import("@/lib/api").then((m) => m.clansApi.mine())}
          />
          <Probe
            name="/game/shop/purchases/mine"
            method="GET"
            run={() => import("@/lib/api").then((m) => m.shopApi.myPurchases())}
          />
          <Probe
            name="/game/reports/mine"
            method="GET"
            run={() => import("@/lib/api").then((m) => m.reportsApi.mine())}
          />
        </Panel>

        {rules.data ? (
          <Panel scanlines={false} className="p-6">
            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              Rules, live from the server
            </p>
            <pre className="overflow-x-auto font-mono text-[11px] leading-5 text-ink-muted">
              {JSON.stringify(rules.data, null, 2)}
            </pre>
          </Panel>
        ) : null}
      </section>

      <Dialog
        open={dialogOpen}
        title="Are you sure?"
        onConfirm={() => setDialogOpen(false)}
        onCancel={() => setDialogOpen(false)}
      >
        Declining costs a heart. On your last heart it ends your season.
      </Dialog>
    </main>
  );
}
