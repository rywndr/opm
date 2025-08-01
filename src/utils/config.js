const config = {
  app: {
    host: process.env.HOST,
    port: process.env.PORT,
  },
  database: {
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    password: String(process.env.PGPASSWORD || ''),
    database: process.env.PGDATABASE,
    port: process.env.PGPORT,
  },
  jwt: {
    accessTokenKey: process.env.ACCESS_TOKEN_KEY,
    refreshTokenKey: process.env.REFRESH_TOKEN_KEY,
    accessTokenAge: process.env.ACCESS_TOKEN_AGE,
  },
  rabbitMq: {
    server: process.env.RABBITMQ_SERVER,
  },
  redis: {
    host: process.env.REDIS_SERVER,
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  },
};

module.exports = config;
