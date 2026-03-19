import * as path from "path";
import { describe, expect, it } from "vitest";
import { ensureLoomStructure } from "../src/config.js";
import { executeRunDoctor } from "../src/app/usecases/run-doctor.js";
import {
  formatDoctorForMcp,
  formatDoctorPayload,
} from "../src/adapters/doctor-adapter.js";
import { makeTempDir } from "./test-utils.js";

describe("adapter consistency", () => {
  it("doctor payload is isomorphic between CLI and MCP adapters", async () => {
    const workDir = await makeTempDir("loom-adapter-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    const report = await executeRunDoctor({
      loomRoot,
      command: {
        staleDays: 30,
        includeThreads: true,
        maxFindings: 20,
        failOn: "none",
      },
    });

    const cliPayload = formatDoctorPayload(report);
    const mcpPayload = JSON.parse(formatDoctorForMcp(report));
    expect(mcpPayload).toStrictEqual(cliPayload);
  });
});
