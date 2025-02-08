import { JSX } from "solid-js";
import { createSignal, createEffect, onCleanup } from "solid-js";

import { resetUdemyProgress } from "@/content-scripts/reset-udemy-progress";

import "~/assets/tailwind.css";

type State = 'initial' | 'progress' | 'done' | 'error';
const RESET_TIMEOUT_MS = 2000;

const statusToButtonText: { [key in State]: string | JSX.Element } = {
  initial: "Clear Progress",
  progress: <span class="loading loading-spinner"></span>,
  done: "Done! 🚀",
  error: "Try Again"
};

export default function App() {
  const [status, setStatus] = createSignal<State>('initial');
  let resetTimer: NodeJS.Timeout | null = null;

  const handleClick = async () => {
    try {
      setStatus('progress')
      const [{ id: tabId }] = await browser.tabs.query({
        active: true, currentWindow: true,
      });
      if (tabId) {
        await browser.scripting.executeScript({
          target: { tabId }, func: resetUdemyProgress,
        });
        console.log('asdas')
        setStatus('done');
      } else {
        setStatus('error')
        console.error('tab.id undefined')
      }
    } catch (error) {
      setStatus('error')
      console.error({ error })
      resetTimer = setTimeout(() => setStatus('initial'), RESET_TIMEOUT_MS)
    }
  }

  createEffect(() => {
    if (status() === 'done') {
      resetTimer = setTimeout(() => setStatus('initial'), RESET_TIMEOUT_MS);
    }
  });

  onCleanup(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });

  return <div>
    <div class="stats shadow w-64 rounded-none">
      <div class="stat">
        <div class="stat-actions w-full mb-8">
          <button
            onClick={handleClick}
            class='btn btn-neutral w-full transition-all hover:scale-105'
            disabled={status() === "progress"}
            aria-busy={status() === "progress"}
            aria-label="Clear Udemy progress"
          >
            {statusToButtonText[status()]}
          </button>
        </div>

        <a
          target='_blank'
          href="https://shramko.dev/?utm_source=udemy-reset-progress&utm_medium=bottom_link&utm_campaign=all&utm_id=promo"
        >
          <p
            class='text-center text-xs select-none stat-title'
          >
            Crafted with ❤️
          </p>
        </a>
      </div>
    </div>
  </div>
}
