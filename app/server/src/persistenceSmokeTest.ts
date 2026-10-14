import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, migrate } from "./db.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function runPersistenceSmokeTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-db-smoke-"));
  const storageDir = path.join(tempRoot, "storage");
  const filename = "test-experiment.sqlite";

  {
    const db = createDb({ storageDir, filename });
    migrate(db);

    db.prepare(
      `
        INSERT INTO schema_migrations (version, applied_at)
        VALUES (?, ?)
      `
    ).run(999, new Date().toISOString());

    db.close();
  }

  {
    const db = createDb({ storageDir, filename });
    migrate(db);

    const row = db
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(999) as { version?: number } | undefined;

    assert(row?.version === 999, "Persistence smoke test failed: record missing after re-open");
    db.close();
  }

  fs.rmSync(tempRoot, { recursive: true, force: true });
  console.log("Persistence smoke test passed");
}

runPersistenceSmokeTest();
