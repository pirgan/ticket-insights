/**
 * Regenerates data/tickets.json - 150 support tickets across three months.
 *
 * The workbook quotes aggregates from this dataset in several modules, so nothing
 * here is hand-typed twice: tickets are built from archetypes plus a deterministic
 * schedule, and every timestamp is computed. Run `npm run verify:data` afterwards;
 * it asserts every figure the workbook cites, reading the generated JSON back.
 *
 * Determinism matters. A seeded PRNG means regenerating produces a byte-identical
 * file, so the dataset never drifts under you between runs.
 *
 * Shape of the data, deliberately:
 *   - Three phases from 2026-06-15 to 2026-08-11 (118 generated tickets), then the
 *     32 hand-written tickets from 2026-08-12 to 2026-09-12.
 *   - CSV-export complaints ramp 2 -> 4 -> 6 -> 7 across those four windows. That
 *     trend is real and findable; several modules depend on it being there.
 *   - 20 of the older tickets are still unresolved, some badly aged. Aging backlog
 *     is the kind of risk signal a weekly report should surface.
 *
 *   node scripts/generate-tickets.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "data", "tickets.json");
const OUT_DIR = path.dirname(OUT);

fs.mkdirSync(OUT_DIR, { recursive: true });

// --- Deterministic PRNG (mulberry32) --------------------------------------

/** Seeded PRNG: same seed, same sequence, so every run rebuilds the same file. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260919);
/** Index into an array by position rather than at random - deterministic choice. */
const pick = (arr, i) => arr[i % arr.length];
/** An integer in [min, max] from the seeded stream. */
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));

// --- Cast -----------------------------------------------------------------

const CUSTOMERS = [
  "Harbourline Logistics",
  "Verdant Health",
  "Kestrel Financial",
  "Nordwall Retail",
  "Atlas Civic",
  "Brightmoor Media",
  "Cobalt Labs",
  "Ridgeway Energy",
  "Pellier Foods",
  "Stonebridge Insurance",
  "Larkfield Education",
  "Orenda Manufacturing",
];

const ASSIGNEES = ["A. Okafor", "M. Lindqvist", "R. Patel", "S. Duarte", "J. Whitfield", "T. Nakamura"];

// Slot values, cycled by use index so a repeated archetype reads differently
// each time. Support genuinely does see the same issue again with different
// specifics - that repetition is what makes "recurring themes" a real lesson.
const SLOTS = {
  n: ["12", "40", "85", "230", "1,400", "6", "18", "62"],
  feature: [
    "Revenue dashboard",
    "Retention report",
    "Cohort explorer",
    "Funnel view",
    "Usage summary",
    "Pipeline board",
  ],
  window: ["yesterday afternoon", "since Monday", "for the past week", "since the last release", "this morning"],
  integration: ["Snowflake", "BigQuery", "Redshift", "Postgres", "S3"],
  idp: ["Okta", "Azure AD", "Google Workspace", "OneLogin"],
};

/** Substitute each {{slot}} in an archetype with a value chosen by the use counter. */
const fill = (text, use) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, key) => pick(SLOTS[key] ?? [key], use + key.length));

// --- Archetypes -----------------------------------------------------------
// `csv` marks a ticket as part of the CSV-export cluster. `band` biases the
// priority: "high" archetypes are the ones that tend to arrive urgent.

const ARCHETYPES = {
  Bug: [
    {
      band: "high",
      subject: "{{feature}} renders blank after sign-in",
      description:
        "Since {{window}}, users signing in land on a completely blank {{feature}}. A hard refresh sometimes recovers it, sometimes not. Around {{n}} people are affected and cannot work.",
    },
    {
      band: "mid",
      subject: "Date filter resets when switching tabs",
      description:
        "Set a custom range on the {{feature}}, switch tabs and come back, and the range has reset to the last 30 days. Any multi-tab analysis means reapplying the filter constantly.",
    },
    {
      band: "mid",
      subject: "Chart legend truncates long series names",
      description:
        "Series names beyond about 20 characters are cut off in the legend with no tooltip, so two of our product lines are indistinguishable on the {{feature}}. Exported images have the same problem.",
    },
    {
      band: "high",
      subject: "API keys rejected after rotation",
      description:
        "We rotated our API keys through the admin panel and every integration began returning 401, including with the new key. Our nightly pipeline into {{integration}} failed completely.",
    },
    {
      band: "mid",
      subject: "Saved filters lost when a dashboard is duplicated",
      description:
        "Duplicating a dashboard produces a copy with all saved filters cleared. We maintain per-region copies of one template, so each duplication means reapplying {{n}} filters by hand.",
    },
    {
      band: "high",
      subject: "Scheduled reports arrive with empty attachments",
      description:
        "Our scheduled reports arrive on time but the attached file is 0 bytes. Generating the same report on demand works. {{n}} scheduled reports go to our leadership team daily.",
    },
    {
      band: "mid",
      subject: "Webhook retries fire duplicate events",
      description:
        "When our endpoint is slow to respond the webhook retries, but the retry carries a new event ID, so we cannot deduplicate it. We have created duplicate records downstream twice {{window}}.",
    },
    {
      band: "low",
      subject: "Tooltip shows the raw column name instead of the alias",
      description:
        "We alias columns to business-friendly names, but hovering a point on the {{feature}} shows the underlying warehouse column name. Minor, but it confuses the people we share dashboards with.",
    },
    {
      band: "high",
      subject: "Row-level permissions leaking data across teams",
      description:
        "A user in our regional team can see rows scoped to another region on the {{feature}}. We have restricted access to the whole workspace until this is understood. This is a confidentiality problem, not a display bug.",
    },
    {
      band: "mid",
      subject: "Totals disagree between the chart and the table",
      description:
        "The {{feature}} summary tile reports a different total from the table immediately below it - a gap of about {{n}}. Both claim the same date range. We cannot tell which one to trust.",
    },
    {
      band: "mid",
      subject: "Sync from {{integration}} silently stops",
      description:
        "Our {{integration}} sync stops without raising any error and the dashboard quietly serves stale data. We only noticed because a figure looked wrong {{window}}. A failed sync should be loud.",
    },
    {
      band: "low",
      subject: "Timezone shown in UTC regardless of workspace setting",
      description:
        "Our workspace is set to Europe/London but timestamps on the {{feature}} render in UTC, so everything is an hour out during summer. Exports have the same offset.",
    },
    {
      band: "mid",
      subject: "Back button loses the applied filter state",
      description:
        "Drilling into a segment on the {{feature}} and pressing the browser back button returns to an unfiltered view rather than the previous state, so the analysis has to be rebuilt each time.",
    },
    {
      band: "high",
      subject: "Two-factor prompt loops on mobile",
      description:
        "On mobile the two-factor prompt reappears immediately after a correct code, in a loop. Desktop is fine. About {{n}} of our field staff only ever use mobile and are locked out entirely.",
    },
  ],
  BugCsv: [
    {
      band: "high",
      subject: "CSV export drops the final row on filtered views",
      description:
        "With any filter applied, the CSV export is missing the last matching row - a {{n}}-row filtered view exports one short. Unfiltered exports are complete. We caught it during a reconciliation and cannot trust exports now.",
    },
    {
      band: "mid",
      subject: "CSV export uses a comma decimal separator for EU locales",
      description:
        "For workspaces on a European locale the CSV export writes decimals with a comma while still using a comma as the field delimiter, so every numeric column shifts when the file is opened.",
    },
    {
      band: "high",
      subject: "CSV export includes hidden columns",
      description:
        "Columns hidden in the view still appear in the CSV export. Some hold internal cost data we deliberately hide before sharing an export with a client. We have stopped sending exports externally.",
    },
    {
      band: "mid",
      subject: "CSV export headers do not match the column order",
      description:
        "The header row of the CSV export is in the view's original column order, but the data rows follow the reordered layout, so every column is mislabelled. Roughly {{n}} rows per export are affected.",
    },
  ],
  Billing: [
    {
      band: "high",
      subject: "Invoice shows duplicate line items",
      description:
        "Our latest invoice lists the same {{n}}-seat line item twice, doubling the total. The seat count in the admin panel is correct. We need a corrected invoice before our finance close.",
    },
    {
      band: "mid",
      subject: "Proration not applied after a mid-cycle seat change",
      description:
        "We added {{n}} seats mid-month and were billed a full month on all of them. The documentation says mid-cycle additions are prorated to the remaining days.",
    },
    {
      band: "high",
      subject: "Card charged twice on renewal",
      description:
        "Our renewal was charged twice on the same day, both for the full amount. The second charge does not appear as an invoice in the billing history. We have asked our bank to hold off on a chargeback.",
    },
    {
      band: "low",
      subject: "Add our VAT number to invoices",
      description:
        "Our invoices do not carry our VAT registration number, which our tax authority requires for cross-border reclaim. Finance has asked whether this can be added to the billing profile.",
    },
    {
      band: "mid",
      subject: "Seat count on the invoice does not match the admin panel",
      description:
        "The invoice bills {{n}} seats; the admin panel shows fewer active users. Nobody has been added this cycle. We would like to understand how the billed figure is derived.",
    },
    {
      band: "high",
      subject: "Payment failed but no notification was sent",
      description:
        "Our card expired and the payment failed silently. We found out when the workspace moved to read-only {{window}}. A warning before the downgrade would have avoided the whole incident.",
    },
    {
      band: "mid",
      subject: "Purchase order number missing from the invoice",
      description:
        "Our accounts payable system rejects the invoice because there is no purchase order field. We cannot pay the renewal until a PO number appears on it.",
    },
    {
      band: "low",
      subject: "Request a consolidated invoice across workspaces",
      description:
        "We run {{n}} workspaces and receive a separate invoice for each. Finance would prefer one consolidated invoice with a per-workspace breakdown.",
    },
  ],
  "Feature Request": [
    {
      band: "low",
      subject: "Weekly cadence for scheduled dashboards",
      description:
        "Dashboards can be scheduled daily or monthly but not weekly, which is the cadence our operations review actually runs on. Today someone exports the {{feature}} by hand every Monday.",
    },
    {
      band: "low",
      subject: "Slack alerts when a metric crosses a threshold",
      description:
        "We would like a Slack message when a tracked metric crosses a threshold we define, rather than discovering it on the {{feature}} the next morning. Email alerts exist but nobody watches that inbox.",
    },
    {
      band: "low",
      subject: "Dark mode for the report builder",
      description:
        "Dashboards support dark mode but the report builder is always light. Several of our analysts work in it for hours at a time and have asked for consistency.",
    },
    {
      band: "mid",
      subject: "Relative date ranges in shared links",
      description:
        "A shared link freezes the absolute dates at the moment of sharing. We would like it to carry 'last 7 days' so the recipient always opens current data instead of a stale window.",
    },
    {
      band: "low",
      subject: "Pin a dashboard to the workspace home page",
      description:
        "Everyone in our workspace opens the {{feature}} first and has to navigate to it each time. Pinning one dashboard as the landing page would save small friction many times a day.",
    },
    {
      band: "mid",
      subject: "Annotations on charts for context",
      description:
        "When a metric moves we explain it in a separate document. Being able to annotate the point directly on the {{feature}} would keep the explanation with the data.",
    },
    {
      band: "mid",
      subject: "Write results back to {{integration}}",
      description:
        "We can read from {{integration}} but not write computed segments back. Our data team currently re-implements the same logic on their side to close the loop.",
    },
    {
      band: "low",
      subject: "Keyboard shortcuts in the query builder",
      description:
        "Our power users spend most of the day in the query builder and have asked for shortcuts for run, save and duplicate, rather than reaching for the mouse each time.",
    },
  ],
  "Feature RequestCsv": [
    {
      band: "mid",
      subject: "Let us choose columns and delimiter before CSV export",
      description:
        "Every CSV export gives all columns with a comma delimiter. Our downstream system needs a subset of columns and a semicolon delimiter, so someone reshapes the file by hand each time.",
    },
  ],
  Account: [
    {
      band: "mid",
      subject: "{{idp}} group mapping not syncing new members",
      description:
        "New hires added to our Analysts group in {{idp}} are not appearing in the matching workspace group. Existing members sync fine. We are adding each new person by hand as a workaround.",
    },
    {
      band: "mid",
      subject: "Cannot remove a deactivated user",
      description:
        "A user was deactivated in {{idp}} but still appears in the member list and still counts against our seat total. The remove button returns 'user not found'.",
    },
    {
      band: "high",
      subject: "Locked out after our admin left",
      description:
        "Our only workspace admin has left and their account was deprovisioned. Nobody remaining can add users, change billing or reach the audit log. We need ownership transferred.",
    },
    {
      band: "low",
      subject: "Transfer workspace ownership without support",
      description:
        "Transferring ownership currently requires a support ticket. We would like admins to be able to do this themselves from the admin panel.",
    },
    {
      band: "mid",
      subject: "Bulk invite by email domain is not working",
      description:
        "Inviting everyone on our verified domain adds nobody and shows no error. Inviting the same people individually works. We are onboarding {{n}} people this month one at a time.",
    },
    {
      band: "low",
      subject: "Audit log only retains 30 days",
      description:
        "Our security review needs twelve months of access history, but the audit log only goes back 30 days and cannot be exported. We have no way to answer the reviewers' questions.",
    },
    {
      band: "mid",
      subject: "Custom role cannot be restricted to one dashboard",
      description:
        "We want contractors to see the {{feature}} and nothing else. The nearest role grants the whole workspace, so we are currently not giving them access at all.",
    },
  ],
  Performance: [
    {
      band: "high",
      subject: "{{feature}} takes over 30 seconds to load",
      description:
        "The {{feature}} has {{n}} widgets and now takes 30-45 seconds to load. It was around 6 seconds a month ago. Nothing about the dashboard itself changed in that window.",
    },
    {
      band: "mid",
      subject: "Query builder autocomplete lags on wide tables",
      description:
        "On a table with about 300 columns the autocomplete takes 4-5 seconds to appear and typed characters arrive out of order. Narrower tables are fine.",
    },
    {
      band: "mid",
      subject: "API responses slow during business hours",
      description:
        "Our integration sees p95 latency of several seconds between 09:00 and 11:00 and well under a second outside that window. Same queries, same volumes.",
    },
    {
      band: "mid",
      subject: "Dashboard sluggish on older hardware",
      description:
        "On our standard-issue laptops the {{feature}} is unusable - scrolling stutters and filters take seconds to apply. Newer machines are fine, but we cannot replace {{n}} laptops.",
    },
  ],
  PerformanceCsv: [
    {
      band: "high",
      subject: "CSV export times out above 100k rows",
      description:
        "Any CSV export beyond roughly 100,000 rows fails with a gateway timeout after about 60 seconds. Our monthly regulatory extract is {{n}},000 rows and now has to be pulled in chunks by hand.",
    },
    {
      band: "mid",
      subject: "CSV export queue backs up during business hours",
      description:
        "Between roughly 09:00 and 11:00 a CSV export that normally returns in 20 seconds sits queued for 10 minutes or more. Outside those hours it is immediate. It looks like contention rather than a fault.",
    },
  ],
};

// --- The 32 hand-written tickets (2026-08-12 .. 2026-09-12) ---------------
// These carry the narrative the workbook leans on, so they stay hand-authored.
// IDs are assigned chronologically across the whole dataset, below.

const FEATURED = [
  ["Invoice shows duplicate line items for September", "Our September invoice lists the same 25-seat line item twice, doubling the total. The seat count in the admin panel is correct at 25. We need a corrected invoice before our finance close on the 30th.", "Billing", "High", "Resolved", "Harbourline Logistics", "A. Okafor", "2026-08-12T09:14:00Z", 8],
  ["Allow dashboards to be scheduled on a weekly cadence", "We can schedule a dashboard daily or monthly but not weekly, which is the cadence our operations review actually runs on. Right now someone exports it by hand every Monday morning.", "Feature Request", "Low", "Closed", "Nordwall Retail", "M. Lindqvist", "2026-08-12T11:02:00Z", 143],
  ["Dashboard renders blank after SSO login", "Since this morning every user signing in through Okta lands on a completely blank dashboard. Signing in with a password works normally. Roughly 40 people are affected and cannot work.", "Bug", "Urgent", "Resolved", "Verdant Health", "R. Patel", "2026-08-13T07:41:00Z", 5],
  ["Cannot remove a deactivated user from the workspace", "A user was deactivated in our identity provider but still appears in the member list and still counts against our seat total. The remove button returns 'user not found'.", "Account", "Medium", "Resolved", "Kestrel Financial", "S. Duarte", "2026-08-13T14:25:00Z", 26],
  ["Date filter resets to default when switching tabs", "Set a custom date range on the Revenue tab, switch to Retention and back, and the range has reset to the last 30 days. It makes any multi-tab analysis painful because the filter has to be reapplied constantly.", "Bug", "High", "Resolved", "Brightmoor Media", "R. Patel", "2026-08-14T10:08:00Z", 11],
  ["Dashboard load times over 30 seconds on large workspaces", "Our main operations dashboard has 14 widgets and now takes 30-45 seconds to load. It was around 6 seconds a month ago. Nothing about the dashboard itself changed in that window.", "Performance", "High", "Resolved", "Harbourline Logistics", "J. Whitfield", "2026-08-15T08:55:00Z", 18],
  ["Proration not applied after a mid-cycle seat change", "We added 12 seats on the 14th of the month and were billed for a full month on all of them. The billing documentation says mid-cycle additions are prorated to the remaining days.", "Billing", "Medium", "Closed", "Cobalt Labs", "A. Okafor", "2026-08-15T16:30:00Z", 30],
  ["Chart legend truncates long series names", "Series names longer than about 20 characters are cut off in the legend with no tooltip, so two of our product lines are indistinguishable on the chart. Exported images have the same problem.", "Bug", "Medium", "Resolved", "Nordwall Retail", "M. Lindqvist", "2026-08-16T09:20:00Z", 42],
  ["Dark mode for the report builder", "The dashboards support dark mode but the report builder is always light. Several of our analysts work in it for hours at a time and have asked for consistency across the product.", "Feature Request", "Low", "Closed", "Atlas Civic", "M. Lindqvist", "2026-08-17T13:45:00Z", 126],
  ["SAML group mapping not syncing new members", "New hires added to our Analysts group in Azure AD are not appearing in the matching workspace group. Existing members sync fine. We are adding each new person by hand as a workaround.", "Account", "High", "Resolved", "Verdant Health", "S. Duarte", "2026-08-18T08:12:00Z", 6],
  ["All API keys returned 401 after key rotation", "We rotated our API keys through the admin panel and every integration immediately began returning 401, including with the new key. Our nightly data pipeline failed completely. This is production-blocking.", "Bug", "Urgent", "Resolved", "Ridgeway Energy", "R. Patel", "2026-08-19T06:33:00Z", 3],
  ["Query builder autocomplete lags on wide tables", "On a table with about 300 columns the autocomplete dropdown takes 4-5 seconds to appear and the typed characters arrive out of order. Narrower tables are fine.", "Performance", "Medium", "Resolved", "Cobalt Labs", "J. Whitfield", "2026-08-20T11:47:00Z", 50],
  ["Request: VAT number on invoices", "Our invoices do not carry our VAT registration number, which our tax authority requires for cross-border reclaim. Finance has asked whether this can be added to the billing profile.", "Billing", "Low", "Closed", "Atlas Civic", "A. Okafor", "2026-08-21T15:05:00Z", 94],
  ["CSV export drops the final row on filtered views", "When a view has any filter applied, the CSV export is missing the last matching row. A 250-row filtered view exports 249 rows. Unfiltered exports are complete. We caught it during a reconciliation and cannot trust the exports now.", "Bug", "High", "Resolved", "Kestrel Financial", "R. Patel", "2026-08-22T09:38:00Z", 14],
  ["Support relative date ranges in shared links", "A shared dashboard link freezes the absolute dates at the moment of sharing. We would like the link to carry 'last 7 days' so the recipient always opens current data instead of a stale window.", "Feature Request", "Medium", "Closed", "Brightmoor Media", "M. Lindqvist", "2026-08-23T10:19:00Z", 118],
  ["Change workspace owner without contacting support", "Transferring workspace ownership currently requires a support ticket. Our previous owner has left and we would like admins to be able to do this themselves from the admin panel.", "Account", "Low", "Closed", "Nordwall Retail", "S. Duarte", "2026-08-24T14:52:00Z", 79],
  ["Saved filters lost when a dashboard is duplicated", "Duplicating a dashboard produces a copy with all saved filters cleared. We maintain per-region copies of one template, so every duplication means reapplying eleven filters by hand.", "Bug", "Medium", "Resolved", "Harbourline Logistics", "R. Patel", "2026-08-25T08:27:00Z", 36],
  ["CSV export times out for datasets over 100k rows", "Any CSV export above roughly 100,000 rows fails with a gateway timeout after about 60 seconds. Our monthly regulatory extract is 340,000 rows and now has to be pulled in chunks by hand.", "Performance", "High", "Resolved", "Ridgeway Energy", "J. Whitfield", "2026-08-26T07:15:00Z", 22],
  ["Card charged twice on annual renewal", "Our annual renewal was charged twice on the same day, both for the full amount. The second charge does not appear as an invoice in the billing history. We have asked our bank to hold off on a chargeback pending your response.", "Billing", "Urgent", "Resolved", "Verdant Health", "A. Okafor", "2026-08-27T12:41:00Z", 67],
  ["CSV export uses a comma decimal separator for EU locales", "For workspaces set to a European locale the CSV export writes decimals with a comma while still using a comma as the field delimiter, so every numeric column shifts when the file is opened. Switching the workspace to en-US avoids it but changes every date format.", "Bug", "Medium", "Resolved", "Atlas Civic", "M. Lindqvist", "2026-08-28T13:56:00Z", 58],
  ["Slack alerting when a metric crosses a threshold", "We would like a Slack message when a tracked metric crosses a threshold we define, rather than discovering it on the dashboard the next morning. Email alerts exist but nobody watches that inbox.", "Feature Request", "Low", "Open", "Cobalt Labs", "M. Lindqvist", "2026-09-02T09:30:00Z", null],
  ["Bulk invite by email domain is not working", "Inviting everyone on our verified domain adds nobody and shows no error. Inviting the same people individually works. We are onboarding 60 people this month and doing it one at a time.", "Account", "Medium", "Open", "Nordwall Retail", "S. Duarte", "2026-09-03T11:12:00Z", null],
  ["Tooltip shows the raw column name instead of the alias", "We alias columns to business-friendly names, but hovering a chart point shows the underlying warehouse column name. Minor, but it confuses the non-technical people we share dashboards with.", "Bug", "Low", "Open", "Brightmoor Media", "R. Patel", "2026-09-04T15:48:00Z", null],
  ["CSV export queue backs up during business hours", "Between roughly 09:00 and 11:00 a CSV export that normally returns in 20 seconds sits queued for 10 minutes or more. Outside those hours it is immediate. It looks like contention rather than a fault, but it is making the morning reporting routine unworkable.", "Performance", "Medium", "In Progress", "Harbourline Logistics", "J. Whitfield", "2026-09-05T08:05:00Z", null],
  ["Enterprise invoice rejected by our accounts payable system", "Our AP system rejects the invoice PDF because it has no purchase order field. We cannot pay the renewal until a PO number appears on the invoice, and the renewal date is in eleven days.", "Billing", "High", "Open", "Ridgeway Energy", "A. Okafor", "2026-09-05T16:22:00Z", null],
  ["CSV export includes hidden columns", "Columns hidden in the view still appear in the CSV export. Some of those columns hold internal cost data we deliberately hide before sharing an export with a client. We have stopped sending exports externally until this is fixed.", "Bug", "High", "In Progress", "Kestrel Financial", "R. Patel", "2026-09-07T10:44:00Z", null],
  ["Pin a dashboard to the workspace home page", "Everyone in our workspace opens the same dashboard first and has to navigate to it each time. Being able to pin one dashboard as the landing page would save a small amount of friction many times a day.", "Feature Request", "Low", "Open", "Atlas Civic", "M. Lindqvist", "2026-09-08T09:07:00Z", null],
  ["Locked out of the workspace after our admin left", "Our only workspace admin has left the company and their account was deprovisioned. Nobody remaining can add users, change billing or access the audit log. We need ownership transferred urgently.", "Account", "Urgent", "Open", "Brightmoor Media", "S. Duarte", "2026-09-09T07:58:00Z", null],
  ["Scheduled reports arrive with empty attachments", "Since the start of the month our scheduled reports arrive on time but the attached file is 0 bytes. Generating the same report on demand works. Three scheduled reports go to our executive team daily.", "Bug", "High", "In Progress", "Verdant Health", "R. Patel", "2026-09-10T06:49:00Z", null],
  ["Let us choose columns and delimiter before CSV export", "Every CSV export gives all columns with a comma delimiter. Our downstream system needs a subset of columns and a semicolon delimiter, so someone reshapes the file by hand each time. A short options step before the export would remove that work entirely.", "Feature Request", "Medium", "Open", "Cobalt Labs", "M. Lindqvist", "2026-09-10T14:31:00Z", null],
  ["Webhook retries fire duplicate events", "When our endpoint is slow to respond the webhook retries, but the retry carries a new event ID, so our system cannot deduplicate it. We have created duplicate records downstream twice this week.", "Bug", "High", "In Progress", "Ridgeway Energy", "J. Whitfield", "2026-09-11T08:26:00Z", null],
  ["CSV export returns a 500 for all users on the Growth plan", "Every CSV export attempt fails immediately with a 500 for all of our users. It started yesterday afternoon with no change on our side. Our whole reporting workflow depends on these exports and we are completely blocked.", "Bug", "Urgent", "Open", "Harbourline Logistics", "R. Patel", "2026-09-12T13:17:00Z", null],
];

// --- Generation schedule --------------------------------------------------
// Category counts per phase land the overall split exactly; `csv` is how many of
// that phase's tickets come from the CSV archetype pools. The ramp is the point.

const PHASES = [
  {
    start: "2026-06-15",
    end: "2026-07-03",
    counts: { Bug: 15, Billing: 6, "Feature Request": 7, Account: 6, Performance: 4 },
    csv: { Bug: 1, "Feature Request": 0, Performance: 1 },
  },
  {
    start: "2026-07-06",
    end: "2026-07-24",
    counts: { Bug: 16, Billing: 7, "Feature Request": 8, Account: 6, Performance: 5 },
    csv: { Bug: 2, "Feature Request": 1, Performance: 1 },
  },
  {
    start: "2026-07-27",
    end: "2026-08-11",
    counts: { Bug: 15, Billing: 6, "Feature Request": 7, Account: 5, Performance: 5 },
    csv: { Bug: 4, "Feature Request": 1, Performance: 1 },
  },
];

const PRIORITY_BY_BAND = {
  high: ["Urgent", "High", "High"],
  mid: ["High", "Medium", "Medium"],
  low: ["Low", "Low", "Medium"],
};

// Resolution time bands in hours - urgent work gets picked up fast, low
// priority drifts. Deliberately wide so the average means something.
const HOURS_BY_PRIORITY = {
  Urgent: [2, 14],
  High: [4, 36],
  Medium: [10, 90],
  Low: [24, 220],
};

/** Every weekday between two dates - tickets are only ever raised on working days. */
function businessDays(startISO, endISO) {
  const days = [];
  const cursor = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

const generated = [];
let useCounter = 0;

// Build each phase: fill its per-category quota from the archetype pools, taking
// the CSV-cluster archetypes first so that theme ramps as intended, then spread
// the tickets evenly across the phase's business days at plausible hours.
for (const phase of PHASES) {
  const days = businessDays(phase.start, phase.end);
  const phaseTickets = [];

  for (const [category, count] of Object.entries(phase.counts)) {
    const csvCount = phase.csv[category] ?? 0;
    const csvPool = ARCHETYPES[`${category}Csv`] ?? [];
    const pool = ARCHETYPES[category];

    for (let i = 0; i < count; i++) {
      const fromCsv = i < csvCount && csvPool.length > 0;
      const source = fromCsv ? csvPool : pool;
      const archetype = pick(source, fromCsv ? i : i + useCounter);
      const use = useCounter++;

      const priority = pick(PRIORITY_BY_BAND[archetype.band], use);
      phaseTickets.push({
        subject: fill(archetype.subject, use),
        description: fill(archetype.description, use),
        category,
        priority,
        band: archetype.band,
        customer: pick(CUSTOMERS, use * 5 + 3),
        assignee: pick(ASSIGNEES, use * 3 + 1),
      });
    }
  }

  // Interleave categories across the phase's business days rather than emitting
  // all the Bugs first, then all the Billing. Deterministic, not shuffled.
  phaseTickets.sort((a, b) => (a.subject.length % 7) - (b.subject.length % 7));

  phaseTickets.forEach((ticket, i) => {
    const day = days[Math.floor((i / phaseTickets.length) * days.length)];
    const createdAt = new Date(day);
    createdAt.setUTCHours(randInt(6, 17), randInt(0, 59), 0, 0);
    generated.push({ ...ticket, createdAt: createdAt.toISOString().replace(".000Z", "Z") });
  });
}

generated.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

// 20 of the 118 older tickets are still unresolved.
//
// Which ones matters. An earlier version of this script picked 20 positions and
// then *forced* five of them to Urgent, which produced an urgent ticket about a
// back button losing its filter state - nonsense a reader spots instantly. So
// the severe ones are drawn from archetypes that are genuinely severe, and each
// ticket simply keeps the priority its archetype implies.
/** Positions of the tickets in (or not in) the severe band, to draw the backlog from. */
const bandIndices = (wantHigh) =>
  generated.map((t, i) => [t, i]).filter(([t]) => (t.band === "high") === wantHigh).map(([, i]) => i);

const highIdx = bandIndices(true);
const otherIdx = bandIndices(false);

// Positions within each pool. The severe picks sit early in the pool, so the
// worst of the backlog is also the oldest - the risk signal a weekly report has
// to surface, and the one a model should notice without being told.
const SEVERE_PICKS = [0, 3, 7, 12, 18];
const MILD_PICKS = [2, 9, 16, 23, 30, 37, 44, 51, 58, 65, 72, 79, 86, 93, 100];

const unresolvedSet = new Set([
  ...SEVERE_PICKS.map((p) => highIdx[p % highIdx.length]),
  ...MILD_PICKS.map((p) => otherIdx[p % otherIdx.length]),
]);

if (unresolvedSet.size !== 20) {
  throw new Error(
    `Expected 20 unresolved generated tickets, got ${unresolvedSet.size}. ` +
      `Pools: ${highIdx.length} high-band, ${otherIdx.length} other.`,
  );
}

const HOUR_MS = 3_600_000;

// Resolve everything not in the unresolved set, giving each a resolution time
// drawn from the band its priority implies; the rest stay Open or In Progress.
const generatedTickets = generated.map((ticket, i) => {
  const { band, ...rest } = ticket;

  if (!unresolvedSet.has(i)) {
    const [lo, hi] = HOURS_BY_PRIORITY[ticket.priority];
    const hours = randInt(lo, hi);
    return {
      ...rest,
      status: pick(["Resolved", "Resolved", "Closed"], i),
      resolvedAt: new Date(new Date(ticket.createdAt).getTime() + hours * HOUR_MS)
        .toISOString()
        .replace(".000Z", "Z"),
    };
  }

  return { ...rest, status: pick(["Open", "In Progress"], i), resolvedAt: null };
});

// The hand-written tickets, expanded from their tuples. A null hours column
// means the ticket is still open.
const featuredTickets = FEATURED.map(
  ([subject, description, category, priority, status, customer, assignee, createdAt, hours]) => ({
    subject,
    description,
    category,
    priority,
    status,
    customer,
    assignee,
    createdAt,
    resolvedAt:
      hours === null
        ? null
        : new Date(new Date(createdAt).getTime() + hours * HOUR_MS)
            .toISOString()
            .replace(".000Z", "Z"),
  }),
);

// IDs are assigned chronologically across the whole dataset, so the flagship
// still-open CSV export outage is the highest-numbered ticket.
const tickets = [...generatedTickets, ...featuredTickets]
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  .map((ticket, i) => ({
    id: `TCK-${1001 + i}`,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    customer: ticket.customer,
    assignee: ticket.assignee,
    createdAt: ticket.createdAt,
    resolvedAt: ticket.resolvedAt,
  }));

fs.writeFileSync(OUT, JSON.stringify(tickets, null, 2) + "\n", "utf8");
console.log(`Wrote ${tickets.length} tickets to ${path.relative(process.cwd(), OUT)}`);
