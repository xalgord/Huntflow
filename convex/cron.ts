import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

/**
 * Recurring Convex jobs.
 *
 * Convex auto-loads `convex/cron.ts` (the default cron module path) on
 * deploy. Each entry schedules an internal function — internal so the
 * client can't trigger it and a cron firing with no authenticated
 * caller still works.
 *
 * Hourly ticket sweep: `sync.cleanupExpiredUploadTickets` drops upload
 * tickets older than `UPLOAD_TICKET_TTL_MS` (1h). Expired tickets are
 * also rejected at use time, so a missed sweep only causes inert-row
 * growth, never a security issue. See `convex/sync.ts`.
 */
const crons = cronJobs();
crons.hourly(
  'cleanup-expired-upload-tickets',
  { minuteUTC: 5 },
  internal.sync.cleanupExpiredUploadTickets
);

export default crons;