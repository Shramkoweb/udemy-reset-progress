import type { ReviewState } from "@/utils/review";
import { DEFAULT_REVIEW_STATE } from "@/utils/review";

const DAY = 86_400_000;

type Seed = { reviewState?: Partial<ReviewState>; successCount?: number };

const done = (hint: string) => {
  console.log(`[review gating] ${hint}`);
  return hint;
};

const seed = async ({ reviewState = {}, successCount = 0 }: Seed, hint: string) => {
  await browser.storage.local.set({
    reviewState: { ...DEFAULT_REVIEW_STATE, ...reviewState },
    successCount,
  });
  return done(hint);
};

const scenarios = {
  async show() {
    const all = await browser.storage.local.get(null);
    const state = (all.reviewState as ReviewState | undefined) ?? DEFAULT_REVIEW_STATE;
    const now = Date.now();
    console.log("reviewState:", state);
    console.log(
      "successCount:", all.successCount ?? 0,
      "| popupOpens:", all.popupOpens ?? 0,
      "| devForceReview:", all.devForceReview ?? false,
    );
    console.log(
      "snoozed:",
      state.snoozeUntil > now ? `${((state.snoozeUntil - now) / DAY).toFixed(1)}d left` : "no",
    );
    return state;
  },

  async clear() {
    await browser.storage.local.remove(["reviewState", "successCount", "popupOpens", "devForceReview"]);
    return done("cleared — reopen the popup");
  },

  arm() {
    return seed(
      { reviewState: { firstSuccessAt: Date.now() - 2 * DAY }, successCount: 1 },
      "armed — run Clear Progress on a Udemy course once",
    );
  },

  armFast() {
    return seed(
      { reviewState: { firstSuccessAt: Date.now() }, successCount: 3 },
      "armed (fast-track) — run Clear Progress once",
    );
  },

  async force(on = true) {
    await browser.storage.local.set({ devForceReview: on });
    return done(on ? "forced — reopen the popup" : "force off");
  },

  snoozed() {
    return seed(
      {
        reviewState: {
          firstSuccessAt: Date.now() - 2 * DAY, promptCount: 1, snoozeUntil: Date.now() + 14 * DAY,
        },
        successCount: 5,
      },
      "snoozed — a successful run must NOT show the prompt",
    );
  },

  responded() {
    return seed(
      { reviewState: { stage: "feedback", lastSentiment: "bad", promptCount: 1 }, successCount: 9 },
      "responded — expect no prompt and no share link",
    );
  },

  lastChance() {
    return seed(
      { reviewState: { firstSuccessAt: Date.now() - 2 * DAY, promptCount: 2 }, successCount: 5 },
      "last chance — dismiss once more, then check stage === 'dismissed'",
    );
  },

};

export function installReviewConsole() {
  // HMR re-runs this module on every edit — only announce the console once.
  const alreadyInstalled = "rg" in globalThis;
  Object.assign(globalThis, { rg: scenarios });
  if (alreadyInstalled) return;
  console.log(`[review gating] rg.${Object.keys(scenarios).join("() · rg.")}()`);
}
