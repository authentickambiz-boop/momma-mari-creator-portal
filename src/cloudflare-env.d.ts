interface CloudflareEnv {
  DB: import("@cloudflare/workers-types").D1Database;
  SESSIONS: import("@cloudflare/workers-types").KVNamespace;
}
