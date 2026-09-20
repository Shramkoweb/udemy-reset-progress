import { describe, it, expect } from "vitest";
import {
  DEFAULT_REVIEW_STATE, FAST_TRACK_SUCCESSES, MAX_PROMPTS, MIN_AGE_MS, MIN_SUCCESSES,
  SNOOZE_MS, afterDismiss, afterFeedback, afterRated, buildFeedbackMailto, buildFeedbackUrl,
  buildFormUrl, buildIssueUrl, buildUninstallUrl, FEEDBACK_FIELDS, hasFeedbackForm,
  hasResponded, isEligible, recordSuccess, feedbackHomeUrl, FEEDBACK_FORM_ID,
  FEEDBACK_REASONS, MAX_COMMENT_LENGTH, type FeedbackReason, type ReviewState,
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

describe("isEligible boundaries", () => {
  it("opens up the moment the age gate is exactly met", () => {
    const s = state({ firstSuccessAt: NOW - MIN_AGE_MS });
    expect(isEligible(s, MIN_SUCCESSES, NOW)).toBe(true);
  });

  it("stays quiet while no success has ever been stamped", () => {
    expect(isEligible(state({ firstSuccessAt: 0 }), MIN_SUCCESSES, NOW)).toBe(false);
  });

  it("still fast-tracks a heavy user who has no stamp yet", () => {
    expect(isEligible(state({ firstSuccessAt: 0 }), FAST_TRACK_SUCCESSES, NOW)).toBe(true);
  });

  it("wakes up on the exact millisecond the snooze expires", () => {
    const s = state({ firstSuccessAt: NOW - 5 * DAY, snoozeUntil: NOW });
    expect(isEligible(s, 10, NOW - 1)).toBe(false);
    expect(isEligible(s, 10, NOW)).toBe(true);
  });

  it("lets the snooze outrank the fast track", () => {
    const s = state({ snoozeUntil: NOW + DAY });
    expect(isEligible(s, FAST_TRACK_SUCCESSES * 10, NOW)).toBe(false);
  });

  it("lets the prompt budget outrank the fast track", () => {
    const s = state({ promptCount: MAX_PROMPTS });
    expect(isEligible(s, FAST_TRACK_SUCCESSES * 10, NOW)).toBe(false);
  });

  it("stays quiet at zero successes however old the install is", () => {
    expect(isEligible(state({ firstSuccessAt: NOW - 365 * DAY }), 0, NOW)).toBe(false);
  });

  it("keeps asking while the budget has room left", () => {
    const s = state({ firstSuccessAt: NOW - 5 * DAY, promptCount: MAX_PROMPTS - 1 });
    expect(isEligible(s, MIN_SUCCESSES, NOW)).toBe(true);
  });
});

describe("the full dismiss lifecycle", () => {
  it("asks at most MAX_PROMPTS times and then goes silent for good", () => {
    let current = state({ firstSuccessAt: NOW });
    let now = NOW;
    let asked = 0;

    for (let day = 0; day < 365; day++) {
      now = NOW + day * DAY;
      if (!isEligible(current, 99, now)) continue;
      asked++;
      current = afterDismiss(current, now);
    }

    expect(asked).toBe(MAX_PROMPTS);
    expect(current.stage).toBe("dismissed");
    expect(isEligible(current, 99, now + 10 * 365 * DAY)).toBe(false);
  });

  it("spaces the prompts a full snooze apart", () => {
    const first = afterDismiss(state({ firstSuccessAt: NOW }), NOW);
    expect(isEligible(first, 99, NOW + SNOOZE_MS - 1)).toBe(false);
    expect(isEligible(first, 99, NOW + SNOOZE_MS)).toBe(true);
  });

  it("counts the prompt even on the run that exhausts the budget", () => {
    const next = afterDismiss(state({ promptCount: MAX_PROMPTS - 1 }), NOW);
    expect(next.promptCount).toBe(MAX_PROMPTS);
    expect(next.snoozeUntil).toBe(NOW + SNOOZE_MS);
  });

  it("never mutates the state it was handed", () => {
    const before = state({ firstSuccessAt: NOW });
    const snapshot = { ...before };

    afterDismiss(before, NOW);
    afterRated(before);
    afterFeedback(before, "meh");
    recordSuccess(before, NOW + DAY);

    expect(before).toEqual(snapshot);
  });

  it("keeps the first-success stamp through every transition", () => {
    const base = state({ firstSuccessAt: NOW });
    expect(afterDismiss(base, NOW).firstSuccessAt).toBe(NOW);
    expect(afterRated(base).firstSuccessAt).toBe(NOW);
    expect(afterFeedback(base, "bad").firstSuccessAt).toBe(NOW);
  });

  it("records the sentiment it was actually given", () => {
    for (const sentiment of ["great", "meh", "bad"] as const) {
      expect(afterFeedback(state(), sentiment).lastSentiment).toBe(sentiment);
    }
  });

  it("spends a prompt when the user rates or reports", () => {
    expect(afterRated(state()).promptCount).toBe(1);
    expect(afterFeedback(state(), "meh").promptCount).toBe(1);
  });
});

describe("feedback payload edge cases", () => {
  const base = {
    sentiment: "meh", reason: "other", comment: "", version: "2.1.0",
    browserName: "Firefox", mode: "auto",
  } as const;

  it("labels every reason the UI can offer", () => {
    for (const { key, label } of FEEDBACK_REASONS) {
      const url = new URL(buildFormUrl({ ...base, reason: key }));
      expect(url.searchParams.get("reason")).toBe(label);
    }
  });

  it("falls back to a generic label for an unknown reason", () => {
    const url = new URL(buildFormUrl({ ...base, reason: "made-up" as FeedbackReason }));
    expect(url.searchParams.get("reason")).toBe("Feedback");
  });

  it("sends an empty comment rather than dropping the field", () => {
    const url = new URL(buildFormUrl(base));
    expect(url.searchParams.get("comment")).toBe("");
  });

  it("trims whitespace-only comments to nothing", () => {
    const url = new URL(buildFormUrl({ ...base, comment: "   \n\t  " }));
    expect(url.searchParams.get("comment")).toBe("");
  });

  it("trims before clamping, so 500 characters always survive", () => {
    const comment = `  ${"y".repeat(MAX_COMMENT_LENGTH)}  `;
    expect(new URL(buildFormUrl({ ...base, comment })).searchParams.get("comment"))
      .toBe("y".repeat(MAX_COMMENT_LENGTH));
  });

  it("keeps a comment that is exactly at the limit intact", () => {
    const comment = "z".repeat(MAX_COMMENT_LENGTH);
    expect(new URL(buildFormUrl({ ...base, comment })).searchParams.get("comment")).toBe(comment);
  });

  it("survives a comment full of URL metacharacters", () => {
    const comment = "a&b=c?d#e /f+g%h\u{1F600}";
    expect(new URL(buildFormUrl({ ...base, comment })).searchParams.get("comment")).toBe(comment);
    expect(new URL(buildIssueUrl({ ...base, comment })).searchParams.get("body")).toContain(comment);
  });

  it("prompts the reporter when the issue body would otherwise be empty", () => {
    const body = new URL(buildIssueUrl(base)).searchParams.get("body") ?? "";
    expect(body).toContain("Describe what happened");
  });

  it("clamps the comment on the GitHub path too", () => {
    const body = new URL(buildIssueUrl({ ...base, comment: "q".repeat(2000) })).searchParams.get("body") ?? "";
    expect(body).toContain("q".repeat(MAX_COMMENT_LENGTH));
    expect(body).not.toContain("q".repeat(MAX_COMMENT_LENGTH + 1));
  });

  it("encodes mailto spaces as %20 so mail clients do not show plus signs", () => {
    const mailto = buildFeedbackMailto({ ...base, comment: "two words" });
    expect(mailto).toContain("two%20words");
    expect(mailto).not.toContain("two+words");
  });

  it("puts the reason in the mailto subject and the context in the body", () => {
    const mailto = buildFeedbackMailto({ ...base, reason: "rate-limited", comment: "logged out" });
    const decoded = decodeURIComponent(mailto);
    expect(decoded).toContain("Udemy Reset Progress — Slow / logged out");
    expect(decoded).toContain("Reason: Slow / logged out");
    expect(decoded).toContain("Rating: meh");
    expect(decoded).toContain("Version: 2.1.0");
    expect(decoded).toContain("Browser: Firefox");
    expect(decoded).toContain("Speed mode: auto");
  });

  it("keeps the uninstall report free of anything the user did not type", () => {
    const url = new URL(buildUninstallUrl({ version: "2.1.0", browserName: "Chrome", mode: "turbo" }));
    expect(url.searchParams.get("comment")).toBeNull();
    expect([...url.searchParams.keys()].toSorted()).toEqual(["browser", "mode", "reason", "source", "version"]);
  });

  it("sends the uninstall report to the same form as the feedback path", () => {
    const uninstall = new URL(buildUninstallUrl({ version: "2.1.0", browserName: "Chrome", mode: "turbo" }));
    const feedback = new URL(buildFormUrl(base));
    expect(uninstall.origin + uninstall.pathname).toBe(feedback.origin + feedback.pathname);
  });

  it("routes the settings link to the form while one is configured", () => {
    expect(feedbackHomeUrl()).toBe(`https://tally.so/r/${FEEDBACK_FORM_ID}`);
  });

  it("declares exactly the fields the form URL carries", () => {
    const url = new URL(buildFormUrl(base));
    expect([...url.searchParams.keys()].toSorted()).toEqual([...FEEDBACK_FIELDS].toSorted());
  });

  it("never emits a relative or javascript: destination", () => {
    const draft = { ...base, comment: "javascript:alert(1)" };
    for (const url of [buildFeedbackUrl(draft), buildFormUrl(draft), buildIssueUrl(draft)]) {
      expect(new URL(url).protocol).toBe("https:");
    }
    expect(buildFeedbackMailto(draft).startsWith("mailto:")).toBe(true);
  });
});
