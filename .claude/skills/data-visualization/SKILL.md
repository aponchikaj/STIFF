---
name: data-visualization
description: "When the user wants to pick a chart type, design a dashboard, or make an existing visualization clearer and more honest. Use when the user says \"chart\", \"dashboard\", \"graph\", \"how should I visualize\", \"which chart type\", \"data viz\", \"axis\", \"legend\", or \"chart colors\". Covers chart selection, visual encoding accuracy, axis integrity, color rules, dashboard layout, decluttering, annotation, and in-chart number formatting — library-agnostic guidance that applies to any tool. For the palette tokens charts draw from, see color-systems. For contrast and colorblind requirements, see accessibility."
metadata:
  version: 1.0.0
---

# Data Visualization

Act as a data visualization specialist in the tradition of Cleveland, Tufte, and Few: someone who treats a chart as an argument, not decoration. The outcome of applying this skill is a visualization or dashboard where the reader answers the intended question in seconds, the encodings are perceptually honest, and nothing on the canvas competes with the data.

## Before Starting

Ask these before recommending anything. A chart chosen without answers to these is a guess.

1. **Audience and question** — Who reads this, and what single question must it answer? An analyst tolerates density an executive will not. "What is the trend?" and "which region wins?" produce different charts from the same data.
2. **Data shape** — How many series, how many categories, what value range, what granularity? A 3-category comparison and a 40-category comparison are different problems. Ask for a sample row if unclear.
3. **Medium and constraints** — Static image, interactive dashboard, slide, or print? Interactive media can defer detail to tooltips; static media must show everything or cut it. Slides get one chart, one point.
4. **Update cadence** — One-off analysis or a live dashboard someone checks daily? Live dashboards need stable scales and layouts so change is visible; one-offs can be tuned to the specific data.

## Chart Selection

Match the reader's question to the chart. Start from the question, never from the data columns or from "what looks impressive."

| Question the reader has | Chart | Notes |
|---|---|---|
| How did this change over time? | Line | One line per series; ≤5 lines before it becomes spaghetti — direct-label the ends, drop the legend |
| How do categories compare? | Bar | Horizontal bars when labels exceed ~10 characters — rotated or truncated labels are a failure state |
| What are the parts of the whole? | Stacked bar (100%) | Prefer over pie; pie only with ≤4 slices summing to an obvious whole (e.g., market share) |
| How is this distributed? | Histogram or box plot | Histogram for one distribution; box plots to compare several side by side |
| Do these two variables relate? | Scatter | Add a trend line only if the relationship is roughly linear; log scales for heavily skewed data |
| What ranks highest? | Ordered bar | Sort by value, not alphabetically — alphabetical order answers no one's question |
| What is the current number? | Stat tile + sparkline | Big number, delta vs. prior period, tiny trend line for context |
| Change over time, across many categories? | Small multiples of lines | One panel per category, shared scales — beats one chart with 12 tangled lines |

Tie-breakers when two chart types both fit:

- Pick the one higher on the encoding hierarchy below.
- Pick the one that needs no legend.
- For part-to-whole where components also need comparing to each other, the 100% stacked bar wins over pie every time: bars share a baseline, slices do not.

## Encoding Hierarchy

Humans decode visual channels with very different accuracy. For quantitative values, the ranking (from Cleveland & McGill's graphical perception experiments) is:

| Rank | Channel | Where it appears | Accuracy |
|---|---|---|---|
| 1 | Position on a common scale | Dot plot, scatter, bar tips, line points | Best — comparison errors of a few percent |
| 2 | Length | Bar charts | Very good, but only from a zero baseline |
| 3 | Angle / slope | Pie slices, line steepness | Mediocre — people misjudge angles by 20%+ |
| 4 | Area | Bubble size, treemap cells | Poor — area differences are systematically underestimated |
| 5 | Color hue / saturation | Heatmap intensity, choropleth | Worst for exact values; fine for "high vs. low" pattern-spotting |

Consequences worth internalizing:

- **Pie charts underperform bars** because they encode with angle and area (ranks 3–4) what a bar encodes with length (rank 2). Readers can rank pie slices but cannot compare them precisely — a 24% slice and a 28% slice look identical. That is why the selection table restricts pie to ≤4 slices with an obvious whole.
- **Bubble charts mislead unless value maps to area, not radius.** Doubling the radius quadruples the area, exaggerating a 2x difference into a perceived 4x. Verify the library scales by area — d3 provides `scaleSqrt` for exactly this; some chart libraries default to radius and must be corrected.
- **Heatmaps are for spotting patterns across hundreds of cells**, not for reading individual values. If exact values matter, put text labels in the cells or use a table with conditional formatting.
- When precision matters most, move the encoding up the hierarchy: replace a pie with a bar, a bubble chart with a scatter, a heatmap with small-multiple bars.

## Axis Integrity

The axis is where honest charts go wrong. These rules are not stylistic preferences — each prevents a specific lie.

- **Bar charts start at zero. Always.** Length encodes the value, so a bar axis starting at 90 makes 95 look double 92 — the reader compares bar lengths, and the lengths are now fiction. If the interesting variation lives in a narrow band, switch to a dot plot or line: position encoding tolerates a zoomed axis; length does not.
- **Line charts may zoom, but flag it.** Position, not length, carries the value, so a non-zero baseline is legitimate for showing variation that a zero baseline would flatten. Mark it visibly: an axis break, or a note like "y-axis starts at 80%", so readers calibrate the amplified slopes.
- **Compared panels share scales.** Small multiples or side-by-side charts with different y-ranges silently lie. If region A is plotted 0–100 and region B 0–10, B looks like A's equal. Fix one scale across all panels; if magnitudes truly differ by orders of magnitude, use a shared log scale or state the difference in an annotation.
- **Time axes get even spacing.** Plotting Jan, Feb, Jun, Jul as four equidistant points fabricates a smooth trend across a four-month gap. Gaps in time must appear as gaps, or the missing months must be shown as missing.
- **Dual y-axes need strong justification.** Two independent scales can make any two series appear correlated, and the crossover point is an artifact of axis choice that readers interpret as an event. Prefer two vertically stacked panels with aligned x-axes, or index both series to 100 at the start so they share one honest scale.
- **Don't clip the data range to manufacture drama.** Axis bounds should cover the data plus modest headroom, chosen once and kept stable across a dashboard's refreshes.

## Scales, Normalization, and Missing Data

Chart type and axis honesty are not enough if the data itself is scaled or gapped misleadingly.

| Situation | Do this | Why |
|---|---|---|
| Values span 3+ orders of magnitude | Log scale, labeled ("log scale") with round-number ticks (1, 10, 100) | A linear scale flattens everything below the max into an unreadable floor |
| Comparing growth across series of different sizes | Index both to 100 at the start, or plot % change | Absolute values make the big series' noise dwarf the small series' trend |
| Comparing regions/segments of different populations | Normalize per-capita or per-account before charting | Raw counts mostly re-plot population size, not the metric |
| Nulls in a time series | Break the line at the gap | Interpolating across a gap draws data that was never collected |
| Zero vs. missing | Plot zeros as zeros; show missing as a visible gap or marker | Conflating them hides outages and fabricates crashes |
| Current partial period (this month so far) | Exclude it, or style it distinctly (dashed, faded) with a label | An in-progress month always looks like a collapse at the chart's right edge |

The partial-period artifact is the most common false alarm on live dashboards — a "why did revenue drop 60%?" escalation that is just today being the 12th of the month.

## Color

- **Single-series charts get one hue.** A bar chart where every bar is a different color forces the reader to ask what the colors mean when they mean nothing. Reserve a second color for the one bar you want the reader to see first.
- **Categorical palettes: 6–8 distinguishable colors maximum.** Beyond that, humans cannot hold the legend mapping in working memory. Group the tail into "Other" or switch to small multiples where each panel is labeled instead of colored.
- **Sequential ramps for magnitude** — light-to-dark of one hue, so darker reliably means more. **Diverging ramps only with a meaningful midpoint** — profit/loss around zero, deviation from a target or average. A diverging ramp on data with no natural center invents a boundary the data does not contain.
- **Design for colorblindness.** Roughly 8% of men have some color vision deficiency, most commonly red-green. Concretely: test every palette under deuteranopia simulation; never let color be the only channel carrying a distinction — pair it with direct labels, marker shape, or position; and default to the Okabe-Ito palette (8 colors verified distinguishable under the common deficiencies) when no brand palette exists.
- **Semantic colors stay semantic.** If green means "up/good" anywhere on the dashboard, it cannot also be an arbitrary category color two charts away.
- Pull actual color tokens from the project's design system — see **color-systems** for the palette tokens charts draw from, and **accessibility** for contrast ratios and colorblind requirements.

## Dashboard Layout

- **F-pattern by altitude.** Readers scan top-left first and attention decays down and right. Row 1: KPI stat tiles — the "is anything on fire?" row. Middle: trend charts explaining the KPIs. Bottom: detail tables for drill-down. Each row answers "why?" about the row above it.
- **5-second rule.** A first-time viewer must answer the dashboard's primary question within 5 seconds. If they must read a legend, hover a tooltip, or mentally combine three charts first, the layout has failed — promote the answer to a stat tile with a delta.
- **~7 widgets per view, maximum.** Beyond that a dashboard becomes a junk drawer where nothing is primary and everything is skimmed. Split by audience or by question into separate views/tabs rather than cramming; a dashboard that serves everyone serves no one.
- **Stable positions and scales for live dashboards.** Regular viewers learn spatial positions — "revenue is top-left." Moving widgets between visits destroys that. Fixed axis ranges matter for the same reason: today's chart must be visually comparable to yesterday's memory of it.
- **Group by question, not by data source.** "Acquisition" widgets together, even if one comes from ads data and one from the product database. The reader's mental model is questions, not pipelines.

### Stat Tile Anatomy

The KPI row is the most-read part of any dashboard, so its tiles deserve a spec:

| Element | Rule |
|---|---|
| Metric label | Plain language ("Monthly signups"), small, above the number |
| Value | Largest text on the tile; abbreviated (48.2k); tabular-nums |
| Delta | Signed, vs. a named baseline ("+12% vs. last month"), colored only if the direction has a good/bad meaning — and note that for churn or cost, down is good |
| Sparkline | Last 30–90 points, no axes, same period as the delta; exists to show shape (steady climb vs. one spike), not values |
| Target (optional) | Thin reference marker or "82% of goal" — only if a real target exists |

A tile showing a number with no delta and no sparkline forces the reader to remember last week's value; context is the tile's entire job.

## Decluttering

Work through removals in this order; each step tests whether the element earns its ink. The goal is a high data-ink ratio — the fraction of ink on the chart that encodes data rather than furniture.

| Step | Remove | Keep when |
|---|---|---|
| 1 | Gridlines — or fade to ~15% opacity | Readers must look up precise values from the chart itself |
| 2 | Chart borders and background fills | Never — whitespace separates charts better than boxes |
| 3 | Legend — direct-label line ends and bars instead | >8 series where labels would collide even after thinning |
| 4 | Axis lines and tick marks where labels alone suffice | The axis break or zoom needs to be visible |
| 5 | Redundant axis labels (every label → every 2nd or 5th) | Sparse data where each point is individually referenced |
| 6 | Decimal places beyond the data's real precision | Regulatory or scientific contexts that require them |

Stop when the next removal would slow a reader down. Decluttering serves comprehension, not minimalism for its own sake.

## Annotation

Label the insight on the chart, not beneath it.

- **The title states the takeaway**, not the metadata: "Signups up 40% since March launch," not "Monthly Signups." The title is the highest-attention text on the chart — spending it on a column-name restatement wastes the best real estate.
- **Callouts sit at the feature they explain**: "March spike = launch" as a short annotation with a thin leader line at the spike itself, not a footnote the reader must connect back. A reader should get the story from title + annotation alone, without decoding a single axis.
- **Reference lines carry labels**: a target line labeled "Target: 500" at its right end, a shaded band labeled "COVID period." An unlabeled dashed line is a puzzle.
- Limit to 1–3 annotations per chart. Annotating everything annotates nothing.

## Tooltips and Interaction

Interaction supplements the static reading — the chart must still work with the mouse untouched, because screenshots, PDFs, and mobile viewers get no hover.

- **Tooltip contents**: series name, exact formatted value, and the period or category — everything needed to quote the data point, nothing more. On multi-series line charts, show all series at the hovered x-position sorted by value, so the tooltip doubles as a ranked snapshot.
- **Hover highlights, the rest fades**: dimming inactive series to ~25% opacity on hover lets a 5-line chart be read one line at a time without a legend.
- **Click-to-filter** across a dashboard (click a region bar, other charts filter to that region) is powerful but must be discoverable — cursor change on hover, and an always-visible "clear filter" chip once active, or users get lost in a filtered state they don't know exists.
- **Zoom/brush** only on dense time series where the full range and the detail both matter; pair with a one-click reset.
- Never hide the primary insight behind interaction. Hover reveals detail; it must not reveal the point.

## Number Formatting in Charts

Numbers inside charts follow different rules than numbers in prose — space is tight and comparison is the job.

| Context | Rule | Example |
|---|---|---|
| Large values on axes and labels | Abbreviate with one decimal | 12,400 → 12.4k; 3,100,000 → 3.1M |
| Stat tiles | Abbreviate the big number; show the delta signed with direction | 48.2k, +12% vs. last month |
| Decimals | Match the data's real precision, 0–2 places, consistent within a chart | 3.14%, not 3.1415926% |
| Aligned columns of numbers (tables, tooltips, tick labels) | `font-variant-numeric: tabular-nums` or a mono-numeral font; right-align; align decimal points | 1,024.50 over   98.25 |
| Units | Symbol once per axis or in the axis title, not on every label | Axis title "Revenue ($M)", labels 1.2, 3.4 |
| Percentages | One decimal max; deltas always signed | 4.2%, +0.8pp |
| Thousands | Separators on any value ≥1,000 that isn't abbreviated | 1,024 |

Without tabular figures, proportional digits make "111" narrower than "999" and columns of numbers wobble, breaking vertical scanning — the main way readers compare values in a table or tooltip.

## Workflow

1. **Ask the Before Starting questions.** Do not skip to chart code.
2. **Write the takeaway sentence first.** "Signups spiked 40% in March after launch." If you cannot write it, you do not yet know what the chart is for.
3. **Select the chart** from the selection table, using the encoding hierarchy and tie-breakers.
4. **Build the honest skeleton**: correct baseline (zero for bars), shared scales across compared panels, evenly spaced time axis, value-sorted categories for rankings.
5. **Apply color deliberately**: one hue for single-series, categorical ≤8, correct ramp type, deuteranopia-checked, tokens from the design system.
6. **Declutter** through the six-step order above until every remaining element earns its ink.
7. **Annotate**: takeaway title, 1–3 callouts at the features they explain, labeled reference lines.
8. **Format the numbers** per the table above — abbreviation, precision, tabular-nums, units once per axis.
9. **Add interaction only where it earns its place** (interactive media): tooltips, hover highlighting, discoverable filters. Confirm the chart still makes its point with zero interaction.
10. **Verify against Common Mistakes** below before delivering.

## Common Mistakes

1. **Pie chart with 6+ slices.** Slices become indistinguishable slivers and the legend becomes a matching puzzle. Fix: ordered horizontal bar, or 100% stacked bar if the part-to-whole framing matters.
2. **Truncated bar axis.** A bar chart starting at 90 turns a 3% difference into an apparent 3x — the lengths readers compare are fabricated. Fix: start at zero, or switch to a dot plot if the variation needs zoom.
3. **Legend when direct labels would work.** Legends force eye ping-pong between key and data. Fix: label line ends and bar values directly; delete the legend.
4. **Rainbow categorical colors on single-series data.** Color implies meaning; meaningless color is noise the reader tries to decode. Fix: one hue, plus one accent color for the single highlighted element.
5. **Alphabetical ordering of a ranking.** "Which is biggest?" takes 10 seconds of scanning instead of zero. Fix: sort by value descending; alphabetical only for lookup tables.
6. **Bubble radius scaled to value.** Doubling radius quadruples perceived size, so differences are exaggerated 2x. Fix: scale area to value (`scaleSqrt` in d3; verify the library's default).
7. **Metadata titles.** "Revenue by Quarter" spends the chart's highest-attention text restating column names. Fix: state the finding — "Revenue doubled in Q3, driven by enterprise."
8. **Dual y-axes to force a correlation.** Independent scales can make any two series move together, and readers treat the crossover as an event. Fix: stacked panels with aligned x-axes, or index both series to 100 at the start.

## Output Format

When recommending a visualization, deliver:

1. **Chart recommendation** — chart type, one-sentence justification tied to the reader's question and the encoding hierarchy, and the rejected runner-up with why.
2. **Spec** — axes (ranges, baseline, scale type), sort order, color assignment (hue count, ramp type, highlight), labeling approach (direct labels vs. legend), and the annotation text for the key insight.
3. **Takeaway title** — the exact title stating the finding.
4. **Implementation** — code in the user's charting stack if known (otherwise ask), with number formatting, declutter steps, and colorblind-safe colors already applied, not left as an exercise.

When reviewing an existing chart or dashboard, deliver a table of issues (issue → why it misleads or slows the reader → concrete fix), ordered by severity: integrity problems first, then encoding choices, then clutter, then polish. For dashboards, additionally state whether the 5-second rule passes and which widget answers the primary question.
