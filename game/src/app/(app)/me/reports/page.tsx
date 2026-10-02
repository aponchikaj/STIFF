"use client";

import { Icon } from "@/components/icon";
import { BackLink } from "@/components/nav";
import {
  Body,
  Button,
  Display,
  Empty,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import type { ReportStatus, ReportView } from "@/lib/api";
import { useMyReports, useWithdrawReport } from "@/lib/queries";
import { cn, formatAgo } from "@/lib/utils";

/**
 * Reports you filed, and what came of them.
 *
 * Deliberately shows the outcome rather than only the status. Someone who
 * reports a clip wants to know whether anything happened — `action_taken`
 * against `no_action` is the answer, and `reporterMessage` is whatever an
 * admin chose to say beyond it. Hiding that is how a reporting system
 * stops being used.
 *
 * It never reveals *what* was done to the other account. That is between
 * them and the panel.
 */

const STATUS_TONE: Record<ReportStatus, string> = {
  open: "text-caution",
  reviewing: "text-cyan",
  resolved: "text-good",
  dismissed: "text-ink-faint",
  withdrawn: "text-ink-faint",
};

export default function MyReportsPage() {
  const reports = useMyReports(50);

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-8 py-4">
        <BackLink href="/me">You</BackLink>

        <header className="flex flex-col gap-3">
          <Label>What you flagged</Label>
          <Display size="title">Reports</Display>
        </header>

        <Rule />

        {reports.isLoading ? (
          <Loading />
        ) : (reports.data?.length ?? 0) === 0 ? (
          <Empty icon="warning" title="You have not reported anything">
            Long-press a hand-in or a comment to flag it.
          </Empty>
        ) : (
          <ul className="flex flex-col gap-8">
            {reports.data?.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </ul>
        )}
      </Screen>
    </main>
  );
}

function ReportRow({ report }: { report: ReportView }) {
  const withdraw = useWithdrawReport();
  // Only a report still on the queue can be taken back.
  const withdrawable = report.status === "open" || report.status === "reviewing";

  return (
    <li className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <span
          className={cn(
            "font-pixel text-[9px] uppercase tracking-[0.14em]",
            STATUS_TONE[report.status],
          )}
        >
          {report.status}
        </span>
        <Label tone="faint">{formatAgo(report.createdAt)}</Label>
      </div>

      <div className="flex items-start gap-3">
        <Icon name="warning" size="xs" className="mt-0.5 opacity-50" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-pixel text-[11px] uppercase tracking-[0.08em] text-ink">
            {report.reasonLabel}
          </span>
          <Label tone="faint">
            {report.targetType.replace("_", " ")} · {report.about}
          </Label>
        </div>
      </div>

      {report.details ? (
        <Body size="sm" className="text-ink-faint">
          {report.details}
        </Body>
      ) : null}

      {/* the outcome, which is the thing a reporter actually came for */}
      {report.outcome ? (
        <Label tone={report.outcome === "action_taken" ? "good" : "faint"}>
          {report.outcome === "action_taken"
            ? "Action was taken"
            : "No action taken"}
        </Label>
      ) : null}

      {report.reporterMessage ? (
        <Body size="sm">{report.reporterMessage}</Body>
      ) : null}

      {withdrawable ? (
        <div>
          <Button
            variant="quiet"
            size="sm"
            marker={false}
            loading={withdraw.isPending}
            onClick={() => withdraw.mutate(report.id)}
          >
            Take it back
          </Button>
        </div>
      ) : null}

      <Rule />
    </li>
  );
}
