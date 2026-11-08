import { Config } from "effect"

export const AppConfig = Config.all({
  databaseUrl: Config.Redacted("DATABASE_URL"),
  jwtSecret: Config.Redacted("JWT_SECRET"),
  googleClientId: Config.String("GOOGLE_CLIENT_ID"),
  googleClientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
  port: Config.Int("PORT").pipe(Config.withDefault(3000)),
  logLevel: Config.LogLevel("LOG_LEVEL").pipe(Config.withDefault("Info"))
})

export type AppConfig = typeof AppConfig
