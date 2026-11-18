import mysql from "mysql2/promise";
import { getMySQLConfig } from "./mysql-client";

// Kept on globalThis: `next dev` re-evaluates this module on every hot reload and per route
// bundle, and a module-level variable then opened a new pool each time until MySQL refused
// connections ("Too many connections").
const poolCache = globalThis as typeof globalThis & { __brandiumMySQLPool?: mysql.Pool };

export async function getMySQLPool(): Promise<mysql.Pool> {
  if (poolCache.__brandiumMySQLPool) {
    return poolCache.__brandiumMySQLPool;
  }

  const config = getMySQLConfig();

  const globalPool = mysql.createPool({
    host: config.host === "localhost" ? "127.0.0.1" : config.host,
    port: config.port,
    user: config.user,
    password: config.password ?? "",
    database: config.database,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    queueLimit: 0,
    // Close idle connections instead of holding the whole limit open forever
    maxIdle: 5,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    charset: "utf8mb4",
    timezone: config.timezone,
    dateStrings: true,
  });

  try {
    // mysql2 forwards the raw callback connection here, whatever the promise typings say
    globalPool.on("connection", (promiseTyped) => {
      const connection = promiseTyped as unknown as {
        query: (sql: string, callback: () => void) => void;
      };
      connection.query("SET time_zone = '+06:00';", () => undefined);
      // A query may not hold a connection forever (`SELECT SLEEP(86400)` from any user used to
      // tie up the whole pool). MariaDB: seconds, all statements; MySQL 8: ms, SELECT only.
      // The one the server does not know fails and is ignored.
      connection.query("SET SESSION max_statement_time = 60;", () => undefined);
      connection.query("SET SESSION max_execution_time = 60000;", () => undefined);
    });
  } catch {
    // Ignore
  }

  poolCache.__brandiumMySQLPool = globalPool;
  return globalPool;
}

export async function createSingleMySQLConnection(): Promise<mysql.Connection> {
  const config = getMySQLConfig();
  const conn = await mysql.createConnection({
    host: config.host === "localhost" ? "127.0.0.1" : config.host,
    port: config.port,
    user: config.user,
    password: config.password ?? "",
    database: config.database,
    timezone: config.timezone,
    dateStrings: true,
  });
  try {
    await conn.query("SET time_zone = '+06:00';");
  } catch {
    // Ignore
  }
  return conn;
}
