// ── Task types (single source of truth) ──────────────────
export const TASK_TYPES = ['photo', 'video'] as const;

export const TASK_TYPE_CAPTURE_HINT: Record<string, string> = {
  photo: 'Take a clear photo',
  video: 'Record a video (max 5s)',
};

// Auto-approve delay in milliseconds (2 minutes)
export const AUTO_APPROVE_DELAY_MS = 2 * 60 * 1000;

// Task acceptance timeout in milliseconds (5 minutes)
// If human doesn't submit within this time, task goes back to pool
export const TASK_ACCEPT_TIMEOUT_MS = 5 * 60 * 1000;

// Agent rejection rate threshold (flag agents rejecting >35%)
export const AGENT_REJECTION_FLAG_PERCENT = 35;

// Location staleness threshold (30 minutes)
export const LOCATION_STALENESS_MINUTES = 30;

// Max humans to notify per task
export const MAX_HUMANS_TO_NOTIFY = 50;

// Fixed task radius in meters (hardcoded for MVP)
export const TASK_RADIUS_METERS = 250;

// Max allowed distance between capture location and task location on submission (GPS drift buffer)
export const MAX_SUBMISSION_DISTANCE_METERS = 100;

// Min/max bounty in rupees
export const MIN_BOUNTY_RUPEES = 10;  // ₹10
export const MAX_BOUNTY_RUPEES = 1000; // ₹1,000
export const MIN_DISCOVERY_CREDITS_RUPEES = 10;

// Task expiry check interval (1 minute)
export const EXPIRY_CHECK_INTERVAL_MS = 60 * 1000;

// Video recording duration (seconds)
export const VIDEO_DURATION_SECONDS = 5;

// Per-type media TTL — Supabase free tier = 50MB, videos need shorter TTL
export const VIDEO_MEDIA_TTL_MS = 5 * 60 * 1000;   // 5 minutes
export const PHOTO_MEDIA_TTL_MS = 30 * 60 * 1000;   // 30 minutes

// Minimum withdrawal amount in rupees (₹1)
export const MIN_WITHDRAWAL_RUPEES = 1;

