const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const frontendDir = path.join(__dirname, "../get-learning-frontend");

module.exports = {
  apps: [
    {
      name: "get-learning-backend",
      cwd: __dirname,
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
        HOST: process.env.HOST || "127.0.0.1",
        PORT: process.env.PORT || "4000",
        PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
        FRONTEND_URL: process.env.FRONTEND_URL,
        CORS_ORIGINS: process.env.CORS_ORIGINS,
      },
    },
    {
      name: "get-learning-frontend",
      cwd: frontendDir,
      script: "./node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
