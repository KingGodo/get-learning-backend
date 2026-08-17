module.exports = {
  apps: [
    {
      name: "getleaning-api",
      cwd: "/var/www/getlearning-backend",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "getleaning-web",
      cwd: "/var/www/getlearning-frontend",
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
