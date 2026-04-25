import {
  createEffect,
  createSignal,
  JSX,
  onCleanup
} from "solid-js";

import { resetUdemyProgress } from "@/content-scripts/reset-udemy-progress";
import type { ScriptResult } from "@/content-scripts/reset-udemy-progress";
import { completeUdemyProgress } from "@/content-scripts/complete-udemy-progress";
import { delayItem } from "@/utils/storage";

import "~/assets/tailwind.css";

type State = "initial" | "progress" | "done" | "error";
const RESET_TIMEOUT_MS = 2000;

const ERROR_MESSAGES: Record<string, string> = {
  NO_CURRICULUM: "Open a Udemy course page first",
  NO_SECTIONS: "No course sections found on this page",
};

export default function App() {
  const [resetStatus, setResetStatus] = createSignal<State>("initial");
  const [completeStatus, setCompleteStatus] = createSignal<State>("initial");
  const [errorMessage, setErrorMessage] = createSignal("");
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const executeScript = async (
    func: typeof resetUdemyProgress | typeof completeUdemyProgress,
    setStatus: (s: State) => void,
  ) => {
    try {
      setStatus("progress");
      setErrorMessage("");
      const [{ id: tabId }] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabId) {
        setErrorMessage("Cannot access the current tab");
        setStatus("error");
        return;
      }
      const delay = await delayItem.getValue();
      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId },
        func,
        args: [delay],
      });

      const scriptResult = result as ScriptResult | undefined;
      if (scriptResult && !scriptResult.success) {
        setErrorMessage(ERROR_MESSAGES[scriptResult.error] ?? "Something went wrong");
        setStatus("error");
        return;
      }

      setStatus("done");
    } catch {
      setErrorMessage("Make sure you're on a Udemy page");
      setStatus("error");
    }
  };

  const handleReset = () => executeScript(resetUdemyProgress, setResetStatus);
  const handleComplete = () => executeScript(completeUdemyProgress, setCompleteStatus);

  createEffect(() => {
    if (resetStatus() === "done" || resetStatus() === "error") {
      resetTimer = setTimeout(() => {
        setResetStatus("initial");
        setErrorMessage("");
      }, RESET_TIMEOUT_MS);
    }
  });

  createEffect(() => {
    if (completeStatus() === "done" || completeStatus() === "error") {
      resetTimer = setTimeout(() => {
        setCompleteStatus("initial");
        setErrorMessage("");
      }, RESET_TIMEOUT_MS);
    }
  });

  onCleanup(() => {
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
  });

  const openSettings = () => {
    browser.runtime.openOptionsPage();
  };

  const isAnyInProgress = () => resetStatus() === "progress" || completeStatus() === "progress";

  const buttonContent = (status: State, label: string, activeLabel: string): JSX.Element => {
    const map: { [key in State]: JSX.Element } = {
      initial: <span>{label}</span>,
      progress: (
        <span class="inline-flex items-center gap-2">
          <span class="loading loading-spinner loading-xs"></span>
          {activeLabel}
        </span>
      ),
      done: <span>Done</span>,
      error: <span>Try Again</span>,
    };
    return map[status];
  };

  return (
    <div class="w-72 p-5 font-sans">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-sm font-semibold tracking-tight text-base-content">
          Udemy Reset Progress
        </h1>
        <button
          onClick={openSettings}
          class="rounded-lg p-1.5 text-base-content/40 transition-colors hover:bg-base-200 hover:text-base-content/70"
          aria-label="Settings"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <button
          onClick={handleReset}
          class="btn w-full rounded-xl border-none text-sm font-medium shadow-sm transition-all duration-200"
          classList={{
            "bg-base-content text-base-100 hover:opacity-85 active:scale-[0.98]": resetStatus() === "initial",
            "bg-base-200 text-base-content/60 cursor-wait": resetStatus() === "progress",
            "bg-emerald-500 text-white": resetStatus() === "done",
            "bg-red-500/90 text-white hover:bg-red-500": resetStatus() === "error",
          }}
          disabled={isAnyInProgress()}
          aria-busy={resetStatus() === "progress"}
          aria-label="Clear Udemy progress"
        >
          {buttonContent(resetStatus(), "Clear Progress", "Resetting...")}
        </button>

        <button
          onClick={handleComplete}
          class="btn w-full rounded-xl border-none text-sm font-medium shadow-sm transition-all duration-200"
          classList={{
            "bg-base-200 text-base-content/70 hover:bg-base-300 active:scale-[0.98]": completeStatus() === "initial",
            "bg-base-200 text-base-content/60 cursor-wait": completeStatus() === "progress",
            "bg-emerald-500 text-white": completeStatus() === "done",
            "bg-red-500/90 text-white hover:bg-red-500": completeStatus() === "error",
          }}
          disabled={isAnyInProgress()}
          aria-busy={completeStatus() === "progress"}
          aria-label="Mark all lessons as complete"
        >
          {buttonContent(completeStatus(), "Mark All Complete", "Completing...")}
        </button>
      </div>

      {errorMessage() && (
        <p class="mt-2 text-center text-xs text-red-500/80">
          {errorMessage()}
        </p>
      )}

      <div class="mt-4 text-center">
        <a
          target="_blank"
          href="https://shramko.dev/?utm_source=udemy-reset-progress&utm_medium=bottom_link&utm_campaign=all&utm_id=promo"
          class="text-xs text-base-content/30 transition-colors hover:text-base-content/50"
        >
          Crafted with ❤️
        </a>
      </div>
    </div>
  );
}
