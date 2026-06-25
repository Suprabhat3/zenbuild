import { db } from "@zenbuild/db";
import type { InngestFunction } from "inngest";

import { githubInstallationSyncRequested, inngest } from "../client";

/**
 * `github/installation.sync` → react to installation lifecycle changes. The case
 * we must handle for correctness is `deleted` (the App was uninstalled on
 * GitHub): we drop the stored installation so we stop attempting to mint tokens
 * for it. Connected `Repository` rows survive with their `installationId` nulled
 * (FK `SetNull`) — they simply can't sync until the App is reinstalled.
 */
export const githubInstallationSyncFn: InngestFunction.Any =
  inngest.createFunction(
    {
      id: "github-installation-sync",
      name: "Sync GitHub installation",
      retries: 2,
      triggers: [githubInstallationSyncRequested],
    },
    async ({ event, step }) => {
      const { installationId, action } = event.data;

      if (action === "deleted") {
        await step.run("remove-installation", async () => {
          await db.githubInstallation.deleteMany({
            where: { installationId: BigInt(installationId) },
          });
        });
        return { ok: true, removed: true };
      }

      // Other actions (suspend/unsuspend/new_permissions_accepted, repos
      // added/removed) need no state change today — repo access is re-checked
      // live on every sync. Acknowledged for forward compatibility.
      return { ok: true, action };
    },
  );
