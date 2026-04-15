import { createSignal, onMount } from "solid-js";

import { delayItem, DEFAULT_DELAY_MS } from "@/utils/storage";

import "~/assets/tailwind.css";

export default function App() {
  const [delay, setDelay] = createSignal(DEFAULT_DELAY_MS);
  const [saved, setSaved] = createSignal(false);

  onMount(async () => {
    const value = await delayItem.getValue();
    setDelay(value);
  });

  const handleChange = async (value: number) => {
    setDelay(value);
    await delayItem.setValue(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const speedLabel = () => {
    const ms = delay();
    if (ms <= 100) return "Fast";
    if (ms <= 250) return "Balanced";
    return "Safe";
  };

  return (
    <div class="min-h-screen bg-base-200/50 font-sans">
      <div class="mx-auto max-w-lg px-6 py-16">
        <h1 class="text-2xl font-bold tracking-tight text-base-content">
          Settings
        </h1>
        <p class="mt-1 text-sm text-base-content/50">
          Udemy Reset Progress
        </p>

        <div class="mt-8 overflow-hidden rounded-2xl bg-base-100 shadow-sm ring-1 ring-base-content/5">
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-medium text-base-content">
                  Action delay
                </h2>
                <p class="mt-0.5 text-xs text-base-content/45">
                  Pause between each progress toggle
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-lg bg-base-200/80 px-2.5 py-1 text-xs font-semibold tabular-nums text-base-content/70"
                >
                  {delay()}ms
                </span>
                <span
                  class="inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium"
                  classList={{
                    "bg-amber-100 text-amber-700": delay() <= 100,
                    "bg-blue-100 text-blue-700": delay() > 100 && delay() <= 250,
                    "bg-emerald-100 text-emerald-700": delay() > 250,
                  }}
                >
                  {speedLabel()}
                </span>
              </div>
            </div>

            <div class="mt-5">
              <input
                type="range"
                min="50"
                max="500"
                step="50"
                value={delay()}
                onInput={(e) => handleChange(Number(e.currentTarget.value))}
                class="range range-xs"
              />
              <div class="mt-2 flex justify-between text-[10px] font-medium text-base-content/30">
                <span>50ms</span>
                <span>500ms</span>
              </div>
            </div>
          </div>

          <div class="border-t border-base-content/5 bg-base-200/30 px-5 py-3">
            <p class="text-xs leading-relaxed text-base-content/40">
              Higher delay reduces the chance of being rate-limited by Udemy.
              If you experience unexpected logouts, increase this value.
            </p>
          </div>
        </div>

        <div
          class="mt-4 text-center text-xs font-medium transition-all duration-300"
          classList={{
            "text-emerald-500 opacity-100": saved(),
            "text-transparent opacity-0": !saved(),
          }}
        >
          Saved
        </div>
      </div>
    </div>
  );
}
