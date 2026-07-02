/** PM2 process for integrator.neeklo.ru API */
module.exports = {
  apps: [
    {
      name: 'neeklo-integrator-api',
      script: '/opt/neeklo-integrator/deploy/start-api.sh',
      interpreter: 'bash',
      max_memory_restart: '512M',
      autorestart: true,
    },
  ],
};
