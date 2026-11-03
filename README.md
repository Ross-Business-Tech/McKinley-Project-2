# McKinley Project 2
This is your team's repository for the Business+Tech AI Sprint.

## Weld Cell Coordinator (team Macy · Ironvale Automotive Parts prototype)
- **What it is:** an AI agent for maintenance technicians that spots welding robots heading toward failure, prepares the repair (work order, reserved parts and tools, technician) with a Safety Lead sign-off gate, and tracks the goal of cutting unplanned downtime by 30%.
- **How to open it:** open the preview link from the latest pull request or session; to build it yourself, run `npm install` then `npm run build` and open the `dist` folder with any static web server.
- **What is simulated:** all machines, sensor readings, parts, technicians and pilot results are invented, and the "AI" is rules and templates in one function, `askAI()` in `src/ai.js` (labeled "Prototype AI (simulated)"), which a real model call could replace later.
