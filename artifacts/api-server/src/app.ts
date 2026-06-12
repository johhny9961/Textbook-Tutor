import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import multer from "multer";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Restrict cross-origin browser access to our own deployments. The SPA is
// served from the same origin as the API, so this does not affect the app
// itself — it only stops other sites from reading API responses in a browser.
// Set ALLOWED_ORIGINS (comma-separated exact origins) to lock this down
// further in production; otherwise we fall back to the Replit/localhost set.
const DEFAULT_ORIGIN_PATTERN =
  /^https?:\/\/([a-z0-9-]+\.)*(replit\.(dev|app)|repl\.co)(:\d+)?$|^https?:\/\/localhost(:\d+)?$/i;

const explicitOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
  if (explicitOrigins.length > 0) return explicitOrigins.includes(origin);
  return DEFAULT_ORIGIN_PATTERN.test(origin);
}

const corsOptions: CorsOptions = {
  origin(origin, cb) {
    // No Origin header = non-browser client or same-origin request; CORS only
    // governs cross-origin browser reads, so allow these through.
    if (!origin) return cb(null, true);
    cb(null, isAllowedOrigin(origin));
  },
};

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File is too large. Maximum size is 100 MB." });
      return;
    }
    res.status(400).json({ error: `Upload error: ${err.message}` });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error." });
});

export default app;
