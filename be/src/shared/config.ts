import { Config } from "effect"

export const AppConfig = Config.all({
  databaseUrl: Config.Redacted("DATABASE_URL"),
  jwtSecret: Config.Redacted("JWT_SECRET"),
  googleClientId: Config.String("GOOGLE_CLIENT_ID"),
  googleClientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
  port: Config.Int("PORT").pipe(Config.withDefault(8000)),
  beanstalkdHost: Config.String("BEANSTALKD_HOST").pipe(Config.withDefault("127.0.0.1")),
  beanstalkdPort: Config.Int("BEANSTALKD_PORT").pipe(Config.withDefault(11300)),
  beanstalkdTube: Config.String("BEANSTALKD_TUBE").pipe(Config.withDefault("voca-imports")),
  logLevel: Config.LogLevel("LOG_LEVEL").pipe(Config.withDefault("Info"))
})

export type AppConfig = typeof AppConfig
