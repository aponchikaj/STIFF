-- What happens when someone actually plays: their calibration, their runs,
-- the runs the server refused, and the boards those runs land on.
--
-- Mirrored by `1787230000000-GamePlay.ts`. This file is the reviewable record
-- of what actually touches the database.
--
-- All new tables, all prefixed `game_`. Nothing existing is altered.

BEGIN;

-- ---------------------------------------------------------------------------
-- Per-device calibration and preferences
-- ---------------------------------------------------------------------------
-- Keyed on (user, device class) rather than on the user, because the two
-- offsets below are properties of the hardware, not the person. A player's
-- phone on Bluetooth and their desktop on wired output need numbers that are
-- hundreds of milliseconds apart, and one shared row would make the game feel
-- broken on whichever device was calibrated second.
--
-- The two offsets are separate for the same reason they are separate in the
-- engine: `audioOffsetMs` corrects when a sound is *heard* and moves the
-- judgement window; `visualOffsetMs` corrects when a frame is *seen* and moves
-- where notes are drawn. Bluetooth adds 150-300ms to the first and nothing to
-- the second, so a single combined value cannot be right for both.
CREATE TABLE IF NOT EXISTS "game_user_settings" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"         uuid NOT NULL,
  "deviceClass"    character varying(16) NOT NULL,
  "audioOffsetMs"  integer NOT NULL DEFAULT 0,
  "visualOffsetMs" integer NOT NULL DEFAULT 0,
  -- Lane index -> array of key codes. Rebindable, so it is data.
  "keybinds"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "scrollSpeed"    double precision NOT NULL DEFAULT 2.4,
  "reducedMotion"  boolean NOT NULL DEFAULT false,
  "laneColorMode"  character varying(24) NOT NULL DEFAULT 'default',
  -- Null means never calibrated, which is what triggers the first-run flow.
  -- Distinct from "calibrated and the answer happened to be zero".
  "calibratedAt"   TIMESTAMP WITH TIME ZONE,
  "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_game_user_settings_deviceClass"
    CHECK ("deviceClass" IN ('desktop','mobile','tablet')),
  CONSTRAINT "CHK_game_user_settings_laneColorMode"
    CHECK ("laneColorMode" IN ('default','highContrast','deuteranopia','protanopia')),
  -- A calibration result outside this range is a mistake, not a preference:
  -- one second of latency is not a device, it is a bug in the flow.
  CONSTRAINT "CHK_game_user_settings_audioOffsetMs"
    CHECK ("audioOffsetMs" BETWEEN -1000 AND 1000),
  CONSTRAINT "CHK_game_user_settings_visualOffsetMs"
    CHECK ("visualOffsetMs" BETWEEN -1000 AND 1000),
  CONSTRAINT "CHK_game_user_settings_scrollSpeed"
    CHECK ("scrollSpeed" > 0 AND "scrollSpeed" <= 10),
  CONSTRAINT "FK_game_user_settings_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "UQ_game_user_settings_device" UNIQUE ("userId", "deviceClass")
);

-- ---------------------------------------------------------------------------
-- Runs
-- ---------------------------------------------------------------------------
-- Every column here is what the *server* decided after replaying the input
-- log. The client's reported score is never stored; it is compared and thrown
-- away, and a mismatch produces a rejection row instead of a run.
--
-- `chartId` is RESTRICT: a chart with runs against it cannot be deleted, only
-- archived. Deleting it would orphan scores that people earned.
--
-- `chartHash` is duplicated from the chart deliberately. It is the evidence of
-- *which* content this score was earned against, and it has to survive
-- independently of the row it came from.
CREATE TABLE IF NOT EXISTS "game_runs" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"          uuid NOT NULL,
  "chartId"         uuid NOT NULL,
  "chartHash"       character varying(64) NOT NULL,
  "score"           integer NOT NULL,
  -- numeric, not double precision: accuracy orders leaderboards and decides
  -- rank thresholds, and float ties that compare differently on two machines
  -- are not a bug anyone enjoys finding.
  "accuracy"        numeric(6,3) NOT NULL,
  "maxCombo"        integer NOT NULL DEFAULT 0,
  "rank"            character varying(2) NOT NULL,
  "judgements"      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Wall-clock time the client took, checked against the song duration. A run
  -- that finished faster than the music is not a run.
  "elapsedMs"       integer NOT NULL,
  "validated"       boolean NOT NULL DEFAULT false,
  -- No-fail practice: never mints coins, never reaches a leaderboard.
  "practiceMode"    boolean NOT NULL DEFAULT false,
  "replayKey"       character varying(512),
  "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_game_runs_rank"
    CHECK ("rank" IN ('P','S','A','B','C','D','F')),
  CONSTRAINT "CHK_game_runs_accuracy"
    CHECK ("accuracy" >= 0 AND "accuracy" <= 100),
  CONSTRAINT "CHK_game_runs_maxCombo" CHECK ("maxCombo" >= 0),
  CONSTRAINT "CHK_game_runs_elapsedMs" CHECK ("elapsedMs" >= 0),
  -- A practice run is never authoritative, so it must never be marked valid.
  CONSTRAINT "CHK_game_runs_practice_not_validated"
    CHECK (NOT ("practiceMode" AND "validated")),
  CONSTRAINT "FK_game_runs_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_game_runs_chart"
    FOREIGN KEY ("chartId") REFERENCES "game_charts"("id") ON DELETE RESTRICT
);

-- The two reads that matter: one player's history, and one chart's best runs.
CREATE INDEX IF NOT EXISTS "IDX_game_runs_user_createdAt"
  ON "game_runs" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_game_runs_chart_score"
  ON "game_runs" ("chartId", "score" DESC)
  WHERE "validated" AND NOT "practiceMode";

-- ---------------------------------------------------------------------------
-- Run tokens
-- ---------------------------------------------------------------------------
-- Issued when a run starts, spent when it is submitted. Single-use: the row is
-- what makes "token reused" detectable, and without it a valid submission
-- could be replayed for coins indefinitely.
CREATE TABLE IF NOT EXISTS "game_run_tokens" (
  "id"           uuid PRIMARY KEY,
  "userId"       uuid NOT NULL,
  "chartId"      uuid NOT NULL,
  "chartHash"    character varying(64) NOT NULL,
  "practiceMode" boolean NOT NULL DEFAULT false,
  "issuedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "expiresAt"    TIMESTAMP WITH TIME ZONE NOT NULL,
  "consumedAt"   TIMESTAMP WITH TIME ZONE,
  CONSTRAINT "FK_game_run_tokens_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_game_run_tokens_chart"
    FOREIGN KEY ("chartId") REFERENCES "game_charts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_game_run_tokens_expiresAt"
  ON "game_run_tokens" ("expiresAt");

-- ---------------------------------------------------------------------------
-- Rejections
-- ---------------------------------------------------------------------------
-- A queue for a human, not an enforcement mechanism. Nothing here bans anyone;
-- statistical cheat detection has false positives, and the cost of wrongly
-- banning a good player is much higher than the cost of a slow review.
CREATE TABLE IF NOT EXISTS "game_run_rejections" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     uuid NOT NULL,
  "chartId"    uuid,
  "runTokenId" uuid,
  "reason"     character varying(32) NOT NULL,
  -- Whatever the check saw: expected vs reported score, the timing histogram,
  -- the elapsed ratio. Shaped per reason, so it is jsonb.
  "detail"     jsonb NOT NULL DEFAULT '{}'::jsonb,
  "reviewedBy" uuid,
  "reviewedAt" TIMESTAMP WITH TIME ZONE,
  "action"     character varying(16),
  "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_game_run_rejections_reason"
    CHECK ("reason" IN (
      'chart_hash_mismatch',
      'score_mismatch',
      'too_fast',
      'superhuman_consistency',
      'token_reused',
      'token_expired',
      'token_unknown',
      'malformed_input_log'
    )),
  CONSTRAINT "CHK_game_run_rejections_action"
    CHECK ("action" IS NULL OR "action" IN ('dismissed','voided','suspended')),
  CONSTRAINT "FK_game_run_rejections_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_game_run_rejections_chart"
    FOREIGN KEY ("chartId") REFERENCES "game_charts"("id") ON DELETE SET NULL,
  CONSTRAINT "FK_game_run_rejections_reviewedBy"
    FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL
);

-- The queue is "unreviewed, newest first".
CREATE INDEX IF NOT EXISTS "IDX_game_run_rejections_pending"
  ON "game_run_rejections" ("createdAt" DESC)
  WHERE "reviewedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_game_run_rejections_user"
  ON "game_run_rejections" ("userId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- Leaderboards
-- ---------------------------------------------------------------------------
-- Materialised best-per-user-per-chart. The unique constraint is the whole
-- design: a second, better run updates the row rather than inserting, so the
-- board can never show one player twice.
--
-- This is the source of truth. Any Redis mirror added later is rebuilt from
-- here and never patched, so a divergence is always resolved in favour of
-- Postgres.
CREATE TABLE IF NOT EXISTS "game_leaderboard_entries" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chartId"    uuid NOT NULL,
  "userId"     uuid NOT NULL,
  "runId"      uuid NOT NULL,
  "score"      integer NOT NULL,
  "accuracy"   numeric(6,3) NOT NULL,
  "maxCombo"   integer NOT NULL DEFAULT 0,
  "rank"       character varying(2) NOT NULL,
  "achievedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Removal is an admin action with a reason attached, never a silent delete.
  "removedAt"  TIMESTAMP WITH TIME ZONE,
  "removedBy"  uuid,
  "removalReason" text,
  CONSTRAINT "FK_game_leaderboard_chart"
    FOREIGN KEY ("chartId") REFERENCES "game_charts"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_game_leaderboard_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_game_leaderboard_run"
    FOREIGN KEY ("runId") REFERENCES "game_runs"("id") ON DELETE RESTRICT,
  CONSTRAINT "FK_game_leaderboard_removedBy"
    FOREIGN KEY ("removedBy") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "CHK_game_leaderboard_removal"
    CHECK (
      ("removedAt" IS NULL AND "removalReason" IS NULL)
      OR ("removedAt" IS NOT NULL AND "removalReason" IS NOT NULL)
    ),
  CONSTRAINT "UQ_game_leaderboard_chart_user" UNIQUE ("chartId", "userId")
);

-- The board read: one chart, best first, removed entries excluded.
CREATE INDEX IF NOT EXISTS "IDX_game_leaderboard_board"
  ON "game_leaderboard_entries" ("chartId", "score" DESC, "achievedAt")
  WHERE "removedAt" IS NULL;

COMMIT;
