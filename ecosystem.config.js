module.exports = {
  apps: [{
    name: "dojopro-api",
    script: "/var/www/dojopro/backend/run.sh",
    cwd: "/var/www/dojopro/backend",
    instances: 1,
    autorestart: true,
    watch: false,
    env: { PORT: "3000" },
    out_file: "/var/www/dojopro/backend/.logs/out.log",
    error_file: "/var/www/dojopro/backend/.logs/err.log",
    merge_logs: true
  }]
}
