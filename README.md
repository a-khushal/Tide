# Tide

Browser extension built with the `Plasmo` framework to measure the real cost of JavaScript on any page. It detects frameworks and libraries, measures script sizes and performance, and surfaces third-party impact so you can spot bloat quickly.

## Features
- Size tracking: total, gzipped, top scripts with percentages
- Framework detection: React, Vue, Angular, Svelte, Next.js, Nuxt (with versions when possible)
- Library detection: common libs (e.g., jQuery, Lodash, D3) with versions
- Performance: long tasks, load/parse breakdown, TTI, main-thread blocking
- Third-party insights: first vs third-party size/count, CDN size/count, top third-party scripts
- Heuristic unused detector: flags third-party scripts with no obvious global footprint (runtime-only)

## Setup
1) Install dependencies: `pnpm install`
2) Development build: `pnpm dev` (loads MV3 build into `build/chrome-mv3-dev`)
3) Load in Chrome: open `chrome://extensions`, enable Developer Mode, “Load unpacked…” and select `build/chrome-mv3-dev`
4) For production: `pnpm build` then load the generated build
