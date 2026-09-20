/**
 * Asserts every figure the workbook quotes about data/tickets.json.
 *
 * The workbook cites these aggregates across several modules. If the
 * dataset drifts, those modules start citing numbers the app does not produce -
 * so this runs from `npm run verify:data` and fails loudly rather than quietly.
 *
 * It reads the generated JSON, never the generator, so a hand-edit to
 * data/tickets.json is caught too.
 *
 *   node scripts/verify-dataset.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tickets = JSON.parse(
  fs.readFileSync(path.join(here, "..", "data", "tickets.json"), "utf8"),
);

const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const CATEGORIES = ["Billing", "Bug", "Feature Request", "Account", "Performance"];
const UNRESOLVED = ["Open", "In Progress"];

const failures = [];
/**
 * Compare one figure against its expected value, print the verdict either way,
 * and collect the failures so the run reports all of them rather than the first.
 */
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok)
    failures.push(
      `${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? ` = ${JSON.stringify(actual)}` : ""}`);
};

// --- Structural integrity -------------------------------------------------

check("ticket count", tickets.length, 150);
check("ids are unique", new Set(tickets.map((t) => t.id)).size, tickets.length);

check(
  "ids run TCK-1001..TCK-1150 in chronological order",
  tickets.every((t, i) => t.id === `TCK-${1001 + i}`) &&
    tickets.every((t, i) => i === 0 || t.createdAt >= tickets[i - 1].createdAt),
  true,
);

const badEnum = tickets.filter(
  (t) =>
    !STATUSES.includes(t.status) ||
    !PRIORITIES.includes(t.priority) ||
    !CATEGORIES.includes(t.category),
);
check("all status/priority/category values are in range", badEnum.map((t) => t.id), []);

const missingField = tickets.filter(
  (t) => !t.subject?.trim() || !t.description?.trim() || !t.customer?.trim() || !t.assignee?.trim(),
);
check("no empty text fields", missingField.map((t) => t.id), []);

const badResolvedFlag = tickets.filter((t) =>
  UNRESOLVED.includes(t.status) ? t.resolvedAt !== null : t.resolvedAt === null,
);
check("resolvedAt is set iff the ticket is Resolved/Closed", badResolvedFlag.map((t) => t.id), []);

const badOrder = tickets.filter(
  (t) => t.resolvedAt && new Date(t.resolvedAt) <= new Date(t.createdAt),
);
check("resolvedAt is after createdAt", badOrder.map((t) => t.id), []);

// --- Figures the workbook quotes ------------------------------------------

// Tally tickets by one field, keyed in sorted order so the object compares
// cleanly against the literal the workbook quotes.
const countBy = (key) =>
  Object.fromEntries(
    [...new Set(tickets.map((t) => t[key]))]
      .sort()
      .map((v) => [v, tickets.filter((t) => t[key] === v).length]),
  );

check("date range", [tickets[0].createdAt.slice(0, 10), tickets.at(-1).createdAt.slice(0, 10)], [
  "2026-06-15",
  "2026-09-12",
]);

check("counts by category", countBy("category"), {
  Account: 22,
  Billing: 24,
  Bug: 58,
  "Feature Request": 28,
  Performance: 18,
});

check("counts by priority", countBy("priority"), { High: 56, Low: 23, Medium: 59, Urgent: 12 });

check("counts by status", countBy("status"), {
  Closed: 38,
  "In Progress": 14,
  Open: 18,
  Resolved: 80,
});

const resolutionHours = tickets
  .filter((t) => t.resolvedAt)
  .map((t) => (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / 3_600_000);

const avg =
  Math.round((resolutionHours.reduce((s, h) => s + h, 0) / resolutionHours.length) * 10) / 10;

check("resolved ticket count", resolutionHours.length, 118);
check("average resolution hours", avg, 45.2);

const unresolved = tickets.filter((t) => !t.resolvedAt);
check("unresolved tickets", unresolved.length, 32);
check(
  "unresolved Urgent/High tickets",
  unresolved.filter((t) => t.priority === "Urgent" || t.priority === "High").length,
  13,
);

// The ageing backlog. Several modules use these two as the worked example of a
// risk a weekly report has to surface without being told to look for it.
check(
  "oldest unresolved ticket",
  { id: unresolved[0].id, raised: unresolved[0].createdAt.slice(0, 10), priority: unresolved[0].priority },
  { id: "TCK-1003", raised: "2026-06-15", priority: "Medium" },
);

const oldestSevere = unresolved.find((t) => t.priority === "Urgent" || t.priority === "High");
check(
  "oldest unresolved High/Urgent ticket",
  { id: oldestSevere.id, raised: oldestSevere.createdAt.slice(0, 10), priority: oldestSevere.priority },
  { id: "TCK-1007", raised: "2026-06-17", priority: "High" },
);

// --- The CSV export cluster -----------------------------------------------

const mentionsCsvExport = tickets.filter((t) =>
  `${t.subject} ${t.description}`.toLowerCase().includes("csv export"),
);
check("tickets mentioning CSV export", mentionsCsvExport.length, 19);

check(
  "CSV export tickets per month",
  Object.fromEntries(
    [...new Set(mentionsCsvExport.map((t) => t.createdAt.slice(0, 7)))]
      .sort()
      .map((m) => [m, mentionsCsvExport.filter((t) => t.createdAt.startsWith(m)).length]),
  ),
  { "2026-06": 1, "2026-07": 7, "2026-08": 7, "2026-09": 4 },
);

const flagship = tickets.find((t) => t.id === "TCK-1150");
check(
  "TCK-1150 is the newest ticket and the open Urgent CSV export outage",
  flagship && {
    newest: flagship.id === tickets.at(-1).id,
    status: flagship.status,
    priority: flagship.priority,
    csv: `${flagship.subject} ${flagship.description}`.toLowerCase().includes("csv export"),
  },
  { newest: true, status: "Open", priority: "Urgent", csv: true },
);

// --- Result ---------------------------------------------------------------

// Non-zero exit on any failure, so this is usable as a gate rather than a report.
if (failures.length > 0) {
  console.error(`\n${failures.length} assertion(s) failed:\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  console.error(
    "data/tickets.json no longer matches the figures the workbook quotes.\n" +
      "Either fix the dataset, or update every module that cites these numbers.\n",
  );
  process.exit(1);
}

console.log(`\nAll ${tickets.length} tickets verified - every figure the workbook quotes holds.`);
