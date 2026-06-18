import cron from 'node-cron';

export const DEFAULT_DAILY_CRON = '0 8 * * *';

export function createDailySchedule(cronExpression: string, callback: () => void | Promise<void>): ReturnType<typeof cron.schedule> {
  return cron.schedule(cronExpression, () => {
    void callback();
  });
}
