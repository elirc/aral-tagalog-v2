import { buildApp } from "./app";
import { env } from "./env";

const app = buildApp();

app.listen({ port: env.port, host: env.host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// finish in-flight requests, then release the pg pool (onClose hook)
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}
