import { buildApp } from "./app";
import { env } from "./env";

const app = buildApp();

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
