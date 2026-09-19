/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 writes an AGENTS.md and CLAUDE.md into the project root on every
  // `next dev`. This repo documents its own conventions elsewhere, and an
  // unexplained generated file in a teaching project is noise - so it's off.
  // Turn it back on if you want Next's own agent guidance in your project.
  agentRules: false,
};

export default nextConfig;
