import { statSync } from "node:fs";
import path from "node:path";

// Validate configuration only. The spec copies this folder and never writes to it.
const source = process.env.THETA_APP_PROFILE_SOURCE_DIR?.trim();
if (!source || !path.isAbsolute(source)) {
  console.error(
    "Profile snapshot requires THETA_APP_PROFILE_SOURCE_DIR=/absolute/path/to/data-folder. No profile snapshot ran.",
  );
  process.exit(2);
}
try {
  if (!statSync(source).isDirectory() || !statSync(path.join(source, "ui-state.json")).isFile()) {
    throw new Error("Missing profile source");
  }
} catch {
  console.error(
    "Profile source must be an existing app data folder that holds ui-state.json. No profile snapshot ran.",
  );
  process.exit(2);
}
