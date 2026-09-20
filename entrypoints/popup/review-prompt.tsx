import { createSignal, For, onCleanup, Show } from "solid-js";

import {
  buildFeedbackMailto, buildFeedbackUrl, buildIssueUrl, FEEDBACK_REASONS, hasFeedbackForm,
  MAX_COMMENT_LENGTH, type FeedbackReason, type Sentiment,
} from "@/utils/review";

export type ReviewResolution =
  | { kind: "rated" }
  | { kind: "feedback"; sentiment: Sentiment; reason: FeedbackReason; comment: string }
  | { kind: "dismissed" };

type Props = {
  context: { version: string; browserName: string; mode: string; reviewUrl: string };
  onResolve: (resolution: ReviewResolution) => Promise<void>;
  onClose: () => void;
};

type Step = "ask" | "promote" | "improve" | "thanks";

const THANKS_TIMEOUT_MS = 2500;

const SENTIMENTS: { key: Sentiment; emoji: string; label: string }[] = [
  { key: "bad", emoji: "\u{1F61E}", label: "Bad" },
  { key: "meh", emoji: "\u{1F610}", label: "Okay" },
  { key: "great", emoji: "\u{1F60D}", label: "Great" },
];

export default function ReviewPrompt(props: Props) {
  const [step, setStep] = createSignal<Step>("ask");
  const [sentiment, setSentiment] = createSignal<Sentiment>("meh");
  const [reason, setReason] = createSignal<FeedbackReason | null>(null);
  const [comment, setComment] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  let thanksTimer: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (thanksTimer) clearTimeout(thanksTimer);
  });

  const draft = () => ({
    sentiment: sentiment(),
    reason: reason() ?? "other",
    comment: comment(),
    version: props.context.version,
    browserName: props.context.browserName,
    mode: props.context.mode,
  });

  const showThanks = () => {
    setStep("thanks");
    thanksTimer = setTimeout(props.onClose, THANKS_TIMEOUT_MS);
  };

  const handleSentiment = (value: Sentiment) => {
    setSentiment(value);
    setStep(value === "great" ? "promote" : "improve");
  };

  const handleDismiss = async () => {
    if (busy()) return;
    setBusy(true);
    await props.onResolve({ kind: "dismissed" });
    props.onClose();
  };

  const handleRate = async () => {
    if (busy()) return;
    setBusy(true);
    // Persist first: opening a tab closes the popup and kills this script.
    await props.onResolve({ kind: "rated" });
    await browser.tabs.create({ url: props.context.reviewUrl });
    showThanks();
  };

  const handleSend = async (url: string) => {
    if (busy()) return;
    setBusy(true);
    await props.onResolve({
      kind: "feedback", sentiment: sentiment(), reason: reason() ?? "other", comment: comment(),
    });
    await browser.tabs.create({ url });
    showThanks();
  };

  const cardClass = "mt-3 rounded-[10px] bg-surface/50 ring-1 ring-ink/5 p-3";
  const linkClass = "text-[11px] text-ink-muted/50 hover:text-ink-muted transition-colors";

  return (<div class={cardClass} role="group" aria-label="Feedback">
    <Show when={step() === "ask"}>
      <div class="flex items-start justify-between gap-2">
        <p class="text-[12px] font-medium leading-snug text-ink">
          How's Udemy Reset Progress working for you?
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          class="-mt-0.5 -mr-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[13px] leading-none text-ink-muted/40 transition-colors hover:text-ink-muted"
          aria-label="Not now"
          title="Not now"
        >
          &times;
        </button>
      </div>

      <div class="mt-2.5 grid grid-cols-3 gap-1.5">
        <For each={SENTIMENTS}>
          {({ key, emoji, label }) => (
            <button
              type="button"
              onClick={() => handleSentiment(key)}
              class="flex flex-col items-center gap-1 rounded-lg bg-white px-2 py-2 ring-1 ring-ink/5 transition-all duration-150 hover:bg-surface active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
              aria-label={label}
            >
              <span class="text-[18px] leading-none">{emoji}</span>
              <span class="text-[10px] font-medium text-ink-muted">{label}</span>
            </button>
          )}
        </For>
      </div>
    </Show>

    <Show when={step() === "promote"}>
      <p class="text-[12px] font-medium leading-snug text-ink">
        Glad to hear it!
      </p>
      <p class="mt-1 text-[11px] leading-relaxed text-ink-muted/70">
        A quick <span class="text-amber-400">&#9733;</span> review helps other learners find the extension.
      </p>
      <button
        type="button"
        onClick={handleRate}
        disabled={busy()}
        class="mt-2.5 h-9 w-full rounded-[10px] bg-brand text-[12px] font-medium text-white shadow-sm transition-all duration-150 hover:bg-brand-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
      >
        Rate on {props.context.browserName === "Firefox" ? "Firefox Add-ons" : "Chrome Web Store"}
      </button>
      <div class="mt-2 text-center">
        <button type="button" onClick={handleDismiss} class={linkClass}>Not now</button>
      </div>
    </Show>

    <Show when={step() === "improve"}>
      <p class="text-[12px] font-medium leading-snug text-ink">
        Sorry about that. What went wrong?
      </p>

      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <For each={FEEDBACK_REASONS}>
          {({ key, label }) => (
            <button
              type="button"
              onClick={() => setReason(key)}
              class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
              classList={{
                "bg-brand text-white": reason() === key,
                "bg-white text-ink-muted ring-1 ring-ink/5 hover:bg-surface": reason() !== key,
              }}
              aria-pressed={reason() === key}
            >
              {label}
            </button>
          )}
        </For>
      </div>

      <Show when={reason()}>
        <textarea
          value={comment()}
          onInput={(e) => setComment(e.currentTarget.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows="2"
          placeholder="Anything else? (optional)"
          class="mt-2 w-full resize-none rounded-lg bg-white px-2.5 py-2 text-[11px] leading-relaxed text-ink ring-1 ring-ink/5 outline-none placeholder:text-ink-muted/50 focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={() => handleSend(buildFeedbackUrl(draft()))}
          disabled={busy()}
          class="mt-2 h-9 w-full rounded-[10px] bg-brand text-[12px] font-medium text-white shadow-sm transition-all duration-150 hover:bg-brand-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
        >
          Send feedback
        </button>
        <p class="mt-1.5 text-[10px] leading-relaxed text-ink-muted/50">
          <Show
            when={hasFeedbackForm()}
            fallback="Opens a pre-filled GitHub issue you can edit before posting."
          >
            Opens a short pre-filled form — no account needed.
          </Show>{" "}
          Prefer{" "}
          <button
            type="button"
            onClick={() => handleSend(buildFeedbackMailto(draft()))}
            class="underline underline-offset-2 hover:text-ink-muted"
          >
            email
          </button>
          <Show when={hasFeedbackForm()}>
            {" "}or{" "}
            <button
              type="button"
              onClick={() => handleSend(buildIssueUrl(draft()))}
              class="underline underline-offset-2 hover:text-ink-muted"
            >
              GitHub
            </button>
          </Show>?
        </p>
      </Show>

      <div class="mt-2 text-center">
        <button type="button" onClick={handleDismiss} class={linkClass}>Not now</button>
      </div>
    </Show>

    <Show when={step() === "thanks"}>
      <p class="text-center text-[12px] font-medium text-ok">
        Thanks — that really helps.
      </p>
    </Show>
  </div>);
}
