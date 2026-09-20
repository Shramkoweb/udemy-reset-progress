import { describe, it, expect } from "vitest";
import {
  DEFAULT_REVIEW_STATE, FAST_TRACK_SUCCESSES, MAX_PROMPTS, MIN_AGE_MS, MIN_SUCCESSES,
  SNOOZE_MS, afterDismiss, afterFeedback, afterRated, buildFeedbackMailto, buildFeedbackUrl,
  buildFormUrl, buildIssueUrl, buildUninstallUrl, FEEDBACK_FIELDS, hasFeedbackForm,
  hasResponded, isEligible, recordSuccess, type ReviewState,
} from "./review";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const state = (patch: Partial<ReviewState> = {}): ReviewState => ({
  ...DEFAULT_REVIEW_STATE,
  ...patch,
});

describe("isEligible", () => {
  it("stays quiet until the user succeeded enough times", () => {
    const s = state({ firstSuccessAt: NOW - 5 * DAY });
    expect(isEligible(s, MIN_SUCCESSES - 1, NOW)).toBe(false);
    expect(isEligible(s, MIN_SUCCESSES, NOW)).toBe(true);
  });

  it("stays quiet on the first day", () => {
    const s = state({ firstSuccessAt: NOW - (MIN_AGE_MS - 1) });
    expect(isEligible(s, MIN_SUCCESSES, NOW)).toBe(false);
  });

  it("skips the age gate for heavy same-day users", () => {
    const s = state({ firstSuccessAt: NOW });
    expect(isEligible(s, FAST_TRACK_SUCCESSES, NOW)).toBe(true);
  });

  it("respects the snooze window", () => {
    const s = state({ firstSuccessAt: NOW - 5 * DAY, snoozeUntil: NOW + DAY });
    expect(isEligible(s, 10, NOW)).toBe(false);
    expect(isEligible(s, 10, NOW + DAY)).toBe(true);
  });

  it("never asks a user who already rated or gave feedback", () => {
    const base = { firstSuccessAt: NOW - 5 * DAY };
    expect(isEligible(state({ ...base, stage: "rated" }), 10, NOW)).toBe(false);
    expect(isEligible(state({ ...base, stage: "feedback" }), 10, NOW)).toBe(false);
    expect(isEligible(state({ ...base, stage: "dismissed" }), 10, NOW)).toBe(false);
  });

  it("stops after the prompt budget is spent", () => {
    const s = state({ firstSuccessAt: NOW - 5 * DAY, promptCount: MAX_PROMPTS });
    expect(isEligible(s, 10, NOW)).toBe(false);
  });
});

describe("recordSuccess", () => {
  it("stamps the first success", () => {
    expect(recordSuccess(state(), NOW).firstSuccessAt).toBe(NOW);
  });

  it("keeps the original stamp on later successes", () => {
    const s = state({ firstSuccessAt: NOW - DAY });
    expect(recordSuccess(s, NOW)).toBe(s);
  });
});

describe("afterDismiss", () => {
  it("snoozes and stays askable", () => {
    const next = afterDismiss(state(), NOW);
    expect(next).toMatchObject({ stage: "idle", promptCount: 1, snoozeUntil: NOW + SNOOZE_MS });
  });

  it("gives up once the budget is spent", () => {
    const next = afterDismiss(state({ promptCount: MAX_PROMPTS - 1 }), NOW);
    expect(next.stage).toBe("dismissed");
  });
});

describe("afterRated / afterFeedback", () => {
  it("marks a promoter as done for good", () => {
    expect(afterRated(state())).toMatchObject({ stage: "rated", lastSentiment: "great" });
  });

  it("marks a detractor as done for good too", () => {
    expect(afterFeedback(state(), "bad")).toMatchObject({ stage: "feedback", lastSentiment: "bad" });
  });
});

describe("hasResponded", () => {
  it("is false only while we have not heard from them", () => {
    expect(hasResponded(state())).toBe(false);
    for (const stage of ["rated", "feedback", "dismissed"] as const) {
      expect(hasResponded(state({ stage }))).toBe(true);
    }
  });

  it("never asks again once they answered, whatever they said", () => {
    const old = { firstSuccessAt: NOW - 30 * DAY, promptCount: 1 };
    expect(isEligible(afterRated(state(old)), 99, NOW + 365 * DAY)).toBe(false);
    expect(isEligible(afterFeedback(state(old), "bad"), 99, NOW + 365 * DAY)).toBe(false);
  });
});

describe("feedback destinations", () => {
  const draft = {
    sentiment: "bad", reason: "not-working", comment: "Nothing happens on my course",
    version: "2.0.1", browserName: "Chrome", mode: "safe",
  } as const;

  it("sends everyone to the account-free form by default", () => {
    expect(hasFeedbackForm()).toBe(true);
    expect(buildFeedbackUrl(draft)).toBe(buildFormUrl(draft));
  });

  it("passes every field the form declares as a query parameter", () => {
    const url = new URL(buildFormUrl(draft));
    expect(url.origin + url.pathname).toMatch(/^https:\/\/tally\.so\/r\/.+/);
    for (const field of FEEDBACK_FIELDS) {
      expect(url.searchParams.has(field)).toBe(true);
    }
    expect(url.searchParams.get("reason")).toBe("Didn't work");
    expect(url.searchParams.get("rating")).toBe("bad");
    expect(url.searchParams.get("comment")).toBe("Nothing happens on my course");
    expect(url.searchParams.get("version")).toBe("2.0.1");
    expect(url.searchParams.get("browser")).toBe("Chrome");
    expect(url.searchParams.get("mode")).toBe("safe");
  });

  it("tags where the report came from", () => {
    expect(new URL(buildFormUrl(draft)).searchParams.get("source")).toBe("popup");
  });

  it("builds an uninstall report with no rating or comment to speak of", () => {
    const url = new URL(buildUninstallUrl({ version: "2.0.1", browserName: "Firefox", mode: "safe" }));
    expect(url.searchParams.get("source")).toBe("uninstall");
    expect(url.searchParams.get("reason")).toBe("Uninstalled");
    expect(url.searchParams.get("browser")).toBe("Firefox");
    expect(url.searchParams.get("mode")).toBe("safe");
    expect(url.searchParams.get("rating")).toBeNull();
  });

  it("clamps an overlong comment before it reaches the form", () => {
    const url = new URL(buildFormUrl({ ...draft, comment: "x".repeat(2000) }));
    expect(url.searchParams.get("comment")).toHaveLength(500);
  });

  it("still builds a labelled, pre-filled issue for the GitHub path", () => {
    const url = new URL(buildIssueUrl(draft));
    expect(url.origin + url.pathname).toBe("https://github.com/Shramkoweb/udemy-reset-progress/issues/new");
    expect(url.searchParams.get("labels")).toBe("feedback");
    expect(url.searchParams.get("title")).toBe("[Feedback] Didn't work");

    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain("Nothing happens on my course");
    expect(body).toContain("Version: 2.0.1");
    expect(body).toContain("Browser: Chrome");
    expect(body).toContain("Speed mode: safe");
  });

  it("falls back to a mailto with the same report", () => {
    const mailto = buildFeedbackMailto(draft);
    expect(mailto.startsWith("mailto:shramko.dev@gmail.com?")).toBe(true);
    expect(decodeURIComponent(mailto)).toContain("Nothing happens on my course");
  });
});
