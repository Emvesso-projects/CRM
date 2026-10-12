import cron from "node-cron";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { jobsService } from "./jobs.service";

export interface FollowUpSchedulerHandle {
  stop: () => void;
}

export const startFollowUpSchedulerJob = (): FollowUpSchedulerHandle | null => {
  if (!env.ENABLE_IN_PROCESS_SCHEDULER) {
    logger.info("In-process follow-up scheduler disabled via ENABLE_IN_PROCESS_SCHEDULER=false");
    return null;
  }

  logger.info("Starting node-cron follow-up scheduler", {
    cronExpression: env.SCHEDULER_CRON_EXPRESSION,
    timeZone: env.APP_TIMEZONE,
  });

  // Shared execution guard covering both startup sweep and cron triggers
  let isExecuting = false;

  const runSchedulerTask = async (trigger: "startup" | "cron") => {
    if (isExecuting) {
      logger.warn("Follow-up scheduler execution skipped: previous run in progress", { trigger });
      return;
    }

    isExecuting = true;
    const startedAt = Date.now();

    try {
      logger.info("Follow-up scheduler execution started", { trigger });
      const summary = await jobsService.run(["follow-up-reminders", "follow-up-overdue"]);
      const durationMs = Date.now() - startedAt;

      logger.info("Follow-up scheduler execution finished", {
        trigger,
        durationMs,
        totalCreated: summary.totalCreated,
        results: summary.results,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      logger.error("Follow-up scheduler execution failed", {
        trigger,
        durationMs,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      isExecuting = false;
    }
  };

  // Immediate catch-up sweep on boot
  void runSchedulerTask("startup");

  // Recurring cron schedule with noOverlap
  const task = cron.schedule(
    env.SCHEDULER_CRON_EXPRESSION,
    async () => {
      await runSchedulerTask("cron");
    },
    {
      noOverlap: true,
      timezone: env.APP_TIMEZONE,
    },
  );

  // Observability lifecycle hooks
  task.on("execution:overlap", () => {
    logger.warn("node-cron detected execution overlap, task skipped");
  });

  task.on("execution:missed", () => {
    logger.warn("node-cron detected execution missed");
  });

  return {
    stop: () => {
      logger.info("Stopping follow-up cron scheduler");
      task.stop();
    },
  };
};
