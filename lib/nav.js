/**
 * One place that knows what the app contains.
 *
 * Each module in the workbook adds a route here. `module` is the workbook module
 * that builds it, so the nav doubles as a table of contents for the app.
 */
/**
 * @typedef {object} NavItem
 * @property {string} href
 * @property {string} label
 * @property {string} blurb
 * @property {string} module  Which workbook module builds this route.
 */

/** @type {NavItem[]} */
export const NAV = [
  { href: "/", label: "Overview", blurb: "The dataset at a glance", module: "Module 5" },
  {
    href: "/tickets",
    label: "Tickets",
    blurb: "Browse, filter and search the data",
    module: "Module 5",
  },
  { href: "/ask", label: "Ask", blurb: "One grounded question, streamed", module: "Modules 7–9" },
  { href: "/chat", label: "Chat", blurb: "Multi-turn, cached and compacted", module: "Module 11" },
  {
    href: "/report",
    label: "Report",
    blurb: "Structured output as a dashboard",
    module: "Modules 10, 14",
  },
  {
    href: "/documents",
    label: "Documents",
    blurb: "Answers with page citations",
    module: "Module 13",
  },
  { href: "/usage", label: "Usage", blurb: "Tokens and spend, per request", module: "Module 12" },
  { href: "/evals", label: "Evals", blurb: "Is it actually any good?", module: "Modules 17–18" },
];