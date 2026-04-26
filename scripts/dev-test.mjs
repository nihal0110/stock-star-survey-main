// Launches the dev server in test mode (points to server/test-data.json instead of real data.json)
// Usage: npm run dev:test
import { spawn } from "child_process";

const child = spawn(
  "npx",
  ["concurrently", "node --watch ./server/index.js", "vite"],
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, TEST_MODE: "true" },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
