import {
  createEffect,
  createSignal,
  JSX,
  onCleanup
} from "solid-js";

import { resetUdemyProgress } from "@/content-scripts/reset-udemy-progress";
import { delayItem } from "@/utils/storage";

import "~/assets/tailwind.css";

type State = "initial" | "progress" | "done" | "error";
const RESET_TIMEOUT_MS = 2000;

const statusToButtonText: { [key in State]: string | JSX.Element } = {
  initial: "Clear Progress",
  progress: <span class="loading loading-spinner"></span>,
  done: "Done! 🚀",
  error: "Try Again"
};

export default function App() {
  const [status, setStatus] = createSignal<State>("initial");
  let resetTimer: NodeJS.Timeout | null = null;

  const handleClick = async () => {
    try {
      setStatus("progress");
      const [{ id: tabId }] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabId) {
        const delay = await delayItem.getValue();
        await browser.scripting.executeScript({
          target: { tabId },
          func: resetUdemyProgress,
          args: [delay],
        });
        setStatus("done");
      } else {
        setStatus("error");
        console.error("tab.id undefined");
      }
    } catch (error) {
      setStatus("error");
      console.error({ error });
      resetTimer = setTimeout(() => setStatus("initial"), RESET_TIMEOUT_MS);
    }
  };

  createEffect(() => {
    if (status() === "done") {
      resetTimer = setTimeout(() => setStatus("initial"), RESET_TIMEOUT_MS);
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

  return <div>
    <div class="stats shadow w-64 rounded-none">
      <div class="stat">
        <div class="stat-actions w-full mb-8">
          <button
            onClick={handleClick}
            class="btn btn-neutral w-full transition-all hover:scale-105"
            disabled={status() === "progress"}
            aria-busy={status() === "progress"}
            aria-label="Clear Udemy progress"
          >
            {statusToButtonText[status()]}
          </button>
        </div>

        <div class="flex items-center justify-between">
          <a
            target="_blank"
            href="https://shramko.dev/?utm_source=udemy-reset-progress&utm_medium=bottom_link&utm_campaign=all&utm_id=promo"
          >
            <p
              class="text-center text-xs select-none stat-title"
            >
              Crafted with ❤️
            </p>
          </a>
          <button
            onClick={openSettings}
            class="btn btn-ghost btn-xs"
            aria-label="Settings"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
}
