export type ReviewStage = "idle" | "rated" | "feedback" | "dismissed";

export type Sentiment = "great" | "meh" | "bad";

export type ReviewState = {
  stage: ReviewStage;
  firstSuccessAt: number;
  snoozeUntil: number;
  promptCount: number;
  lastSentiment: Sentiment | null;
};

export const DEFAULT_REVIEW_STATE: ReviewState = {
  stage: "idle",
  firstSuccessAt: 0,
  snoozeUntil: 0,
  promptCount: 0,
  lastSentiment: null,
};

const DAY_MS = 86_400_000;

export const MIN_SUCCESSES = 2;
export const MIN_AGE_MS = DAY_MS;
/** Bypasses MIN_AGE_MS rather than adding to it. */
export const FAST_TRACK_SUCCESSES = 4;
export const SNOOZE_MS = 14 * DAY_MS;
export const MAX_PROMPTS = 3;

export const MAX_COMMENT_LENGTH = 500;

/** Every nudge in the extension must check this, not just the prompt. */
export function hasResponded(state: ReviewState): boolean {
  return state.stage !== "idle";
}

export function isEligible(state: ReviewState, successCount: number, now: number): boolean {
  if (hasResponded(state)) return false;
  if (state.promptCount >= MAX_PROMPTS) return false;
  if (now < state.snoozeUntil) return false;
  if (successCount >= FAST_TRACK_SUCCESSES) return true;
  if (successCount < MIN_SUCCESSES) return false;
  return state.firstSuccessAt > 0 && now - state.firstSuccessAt >= MIN_AGE_MS;
}

export function recordSuccess(state: ReviewState, now: number): ReviewState {
  if (state.firstSuccessAt > 0) return state;
  return { ...state, firstSuccessAt: now };
}

export function afterDismiss(state: ReviewState, now: number): ReviewState {
  const promptCount = state.promptCount + 1;
  return {
    ...state,
    promptCount,
    snoozeUntil: now + SNOOZE_MS,
    stage: promptCount >= MAX_PROMPTS ? "dismissed" : "idle",
  };
}

export function afterRated(state: ReviewState): ReviewState {
  return {
    ...state,
    stage: "rated",
    lastSentiment: "great",
    promptCount: state.promptCount + 1,
  };
}

export function afterFeedback(state: ReviewState, sentiment: Sentiment): ReviewState {
  return {
    ...state,
    stage: "feedback",
    lastSentiment: sentiment,
    promptCount: state.promptCount + 1,
  };
}

export const FEEDBACK_REASONS = [
  { key: "not-working", label: "Didn't work" },
  { key: "rate-limited", label: "Slow / logged out" },
  { key: "missing-feature", label: "Missing a feature" },
  { key: "other", label: "Something else" },
] as const;

export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]["key"];

export const ISSUES_URL = "https://github.com/Shramkoweb/udemy-reset-progress/issues/new";
export const SUPPORT_EMAIL = "shramko.dev@gmail.com";

export const FEEDBACK_FORM_ID = "obJz2b";

const TALLY_BASE = "https://tally.so/r/";

/** Must match the form's hidden field names exactly; a rename fails silently. */
export const FEEDBACK_FIELDS = ["source", "reason", "rating", "comment", "version", "browser", "mode"] as const;

export const hasFeedbackForm = () => FEEDBACK_FORM_ID.length > 0;

export const feedbackHomeUrl = () =>
  hasFeedbackForm() ? `${TALLY_BASE}${FEEDBACK_FORM_ID}` : ISSUES_URL;

export type ReportContext = {
  version: string;
  browserName: string;
  mode: string;
};

export type FeedbackDraft = ReportContext & {
  sentiment: Sentiment;
  reason: FeedbackReason;
  comment: string;
};

function reasonLabel(reason: FeedbackReason): string {
  return FEEDBACK_REASONS.find((r) => r.key === reason)?.label ?? "Feedback";
}

function feedbackBody(draft: FeedbackDraft): string {
  const comment = draft.comment.trim().slice(0, MAX_COMMENT_LENGTH);
  return [
    comment || "_Describe what happened — the more detail, the faster the fix._",
    "",
    "---",
    `Reason: ${reasonLabel(draft.reason)}`,
    `Rating: ${draft.sentiment}`,
    `Version: ${draft.version}`,
    `Browser: ${draft.browserName}`,
    `Speed mode: ${draft.mode}`,
  ].join("\n");
}

export function buildFormUrl(draft: FeedbackDraft): string {
  const params = new URLSearchParams({
    source: "popup",
    reason: reasonLabel(draft.reason),
    rating: draft.sentiment,
    comment: draft.comment.trim().slice(0, MAX_COMMENT_LENGTH),
    version: draft.version,
    browser: draft.browserName,
    mode: draft.mode,
  });
  return `${TALLY_BASE}${FEEDBACK_FORM_ID}?${params.toString()}`;
}

export function buildIssueUrl(draft: FeedbackDraft): string {
  const params = new URLSearchParams({
    labels: "feedback",
    title: `[Feedback] ${reasonLabel(draft.reason)}`,
    body: feedbackBody(draft),
  });
  return `${ISSUES_URL}?${params.toString()}`;
}

export function buildFeedbackUrl(draft: FeedbackDraft): string {
  return hasFeedbackForm() ? buildFormUrl(draft) : buildIssueUrl(draft);
}

export function buildUninstallUrl(ctx: ReportContext): string {
  const params = new URLSearchParams({
    source: "uninstall",
    reason: "Uninstalled",
    version: ctx.version,
    browser: ctx.browserName,
    mode: ctx.mode,
  });
  return `${TALLY_BASE}${FEEDBACK_FORM_ID}?${params.toString()}`;
}

export function buildFeedbackMailto(draft: FeedbackDraft): string {
  // Not URLSearchParams: mail clients read "+" literally instead of as a space.
  const subject = encodeURIComponent(`Udemy Reset Progress — ${reasonLabel(draft.reason)}`);
  const body = encodeURIComponent(feedbackBody(draft));
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
