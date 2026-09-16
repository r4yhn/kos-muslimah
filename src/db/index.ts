import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL tidak ditemukan. Salin .env.example ke .env dan isi koneksi PostgreSQL Supabase."
  );
}

/**
 * Mencegah pembuatan koneksi baru berulang saat hot-reload di development.
 */
const globalForDb = globalThis as unknown as {
  __kosDbClient?: ReturnType<typeof postgres>;
  __kosDb?: ReturnType<typeof drizzle<typeof schema>>;
};

const client =
  globalForDb.__kosDbClient ??
  postgres(connectionString, {
    /**
     * `prepare: false` diperlukan jika memakai Transaction/Session pooler Supabase.
     */
    prepare: false,
    max: 5,
  });

const db = globalForDb.__kosDb ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__kosDbClient = client;
  globalForDb.__kosDb = db;
}

export { client, db, schema };
