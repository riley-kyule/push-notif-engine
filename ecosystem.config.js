// PM2 process definitions for the three EPE services.
//
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 reload ecosystem.config.js   # zero-downtime reload after a deploy
//   pm2 logs / pm2 status
//
// PM2's `env_file` option is unreliable across versions (confirmed empty env
// in testing on PM2 7.0.1), so each app's .env is parsed here directly and
// passed via the `env` field instead — no dependency on PM2 internals.
const fs = require("fs");
const path = require("path");

function loadEnvFile(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) {
    return {};
  }

  const env = {};
  for (const line of fs.readFileSync(fullPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: "epe-api",
      cwd: path.join(__dirname, "services/api"),
      script: "dist/main.js",
      env: loadEnvFile("services/api/.env"),
      instances: 1,
      exec_mode: "fork",
      max_restarts: 10,
      restart_delay: 2000,
      out_file: path.join(__dirname, "logs/epe-api.out.log"),
      error_file: path.join(__dirname, "logs/epe-api.err.log"),
      time: true,
    },
    {
      name: "epe-worker",
      cwd: path.join(__dirname, "services/worker"),
      script: "dist/src/main.js",
      env: loadEnvFile("services/worker/.env"),
      instances: 1,
      exec_mode: "fork",
      max_restarts: 10,
      restart_delay: 2000,
      out_file: path.join(__dirname, "logs/epe-worker.out.log"),
      error_file: path.join(__dirname, "logs/epe-worker.err.log"),
      time: true,
    },
    {
      name: "epe-dashboard",
      cwd: path.join(__dirname, "apps/dashboard"),
      script: "node_modules/.bin/next",
      args: "start",
      env: loadEnvFile("apps/dashboard/.env"),
      instances: 1,
      exec_mode: "fork",
      max_restarts: 10,
      restart_delay: 2000,
      out_file: path.join(__dirname, "logs/epe-dashboard.out.log"),
      error_file: path.join(__dirname, "logs/epe-dashboard.err.log"),
      time: true,
    },
  ],
};
