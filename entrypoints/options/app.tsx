import { createSignal, onMount } from "solid-js";

import { DEFAULT_DELAY_MS, delayItem } from "@/utils/storage";

import "~/assets/tailwind.css";

export default function App() {
  const [delay, setDelay] = createSignal(DEFAULT_DELAY_MS);
  const [saved, setSaved] = createSignal(false);
  let rangeRef: HTMLInputElement | undefined;

  const updateTrackFill = (value: number) => {
    if (!rangeRef) return;
    const pct = ((value - 50) / (500 - 50)) * 100;
    rangeRef.style.background = `linear-gradient(to right, #6366f1 ${pct}%, #e5e5e7 ${pct}%)`;
  };

  onMount(async () => {
    const value = await delayItem.getValue();
    setDelay(value);
    updateTrackFill(value);
  });

  const handleChange = async (value: number) => {
    setDelay(value);
    updateTrackFill(value);
    await delayItem.setValue(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = async () => {
    await handleChange(DEFAULT_DELAY_MS);
  };

  const speedLabel = () => {
    const ms = delay();
    if (ms <= 100) return "Fast";
    if (ms <= 250) return "Balanced";
    return "Safe";
  };

  return (<div class="max-w-80 mx-auto p-4 font-sans">
      <div class="flex items-center justify-between mb-3.5">
        <div>
          <h1 class="text-[15px] font-semibold tracking-tight text-ink">
            Udemy Reset Progress
          </h1>
          <p class="text-[11px] text-ink-muted mt-0.5">
            Settings
          </p>
        </div>
        <div
          class="text-[11px] font-medium transition-all duration-300"
          classList={{
            "text-ok opacity-100": saved(), "text-ok opacity-0": !saved(),
          }}
        >
          Saved
        </div>
      </div>

      <div class="overflow-hidden rounded-[10px] bg-surface/50 ring-1 ring-ink/5">
        <div class="p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-[13px] font-medium text-ink">
              Action delay
            </h2>
            <div class="flex items-center gap-1.5">
              <span
                class="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink/70 ring-1 ring-ink/5"
              >
                {delay()}ms
              </span>
              <span
                class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                classList={{
                  "bg-amber-100 text-amber-700": delay() <= 100,
                  "bg-brand-soft text-brand": delay() > 100 && delay() <= 250,
                  "bg-emerald-100 text-emerald-700": delay() > 250,
                }}
              >
                {speedLabel()}
              </span>
            </div>
          </div>

          <div class="mt-4">
            <input
              ref={rangeRef}
              type="range"
              min="50"
              max="500"
              step="50"
              value={delay()}
              onInput={(e) => handleChange(Number(e.currentTarget.value))}
              class="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
            />
            <div class="mt-1.5 flex justify-between text-[10px] font-medium text-ink-muted/50">
              <span>50ms</span>
              <span>500ms</span>
            </div>
          </div>
        </div>

        <div class="border-t border-ink/5 bg-surface/40 px-4 py-2.5">
          <p class="text-[11px] leading-relaxed text-ink-muted/70">
            Higher delay reduces the chance of being rate-limited.
            If you experience unexpected logouts, increase this value.
          </p>
        </div>
      </div>

      <button
        onClick={handleReset}
        class="mt-2.5 w-full h-8 rounded-[10px] bg-surface text-[12px] font-medium text-ink-muted hover:bg-surface-hover active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
        classList={{
          "invisible": delay() === DEFAULT_DELAY_MS,
        }}
      >
        Reset to default ({DEFAULT_DELAY_MS}ms)
      </button>
    </div>);
}
