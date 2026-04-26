import { createSignal, onMount, Show } from "solid-js";

import type { Mode } from "@/utils/pacing";
import { modeItem, customDelayItem, customBatchSizeItem } from "@/utils/storage";

import "~/assets/tailwind.css";

const PRESET_OPTIONS: { key: "turbo" | "balanced" | "safe"; name: string; desc: string }[] = [
  { key: "turbo", name: "Turbo", desc: "Fastest speed for small courses" },
  { key: "balanced", name: "Balanced", desc: "Recommended for most courses" },
  { key: "safe", name: "Safe", desc: "Reliable for large courses" },
];

export default function App() {
  const [mode, setMode] = createSignal<Mode>("auto");
  const [customDelay, setCustomDelay] = createSignal(250);
  const [customBatch, setCustomBatch] = createSignal(30);
  const [saved, setSaved] = createSignal(false);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);
  let delayRef: HTMLInputElement | undefined;
  let batchRef: HTMLInputElement | undefined;

  const updateTrackFill = (el: HTMLInputElement | undefined, value: number, min: number, max: number) => {
    if (!el) return;
    const pct = ((value - min) / (max - min)) * 100;
    el.style.background = `linear-gradient(to right, #6366f1 ${pct}%, #e5e5e7 ${pct}%)`;
  };

  onMount(async () => {
    const m = await modeItem.getValue();
    setMode(m);

    const d = await customDelayItem.getValue();
    setCustomDelay(d);

    const b = await customBatchSizeItem.getValue();
    setCustomBatch(b);

    if (m === "custom") setAdvancedOpen(true);

    updateTrackFill(delayRef, d, 50, 1000);
    updateTrackFill(batchRef, b, 5, 50);
  });

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveMode = async (m: Mode) => {
    setMode(m);
    await modeItem.setValue(m);
    flashSaved();
  };

  const handleAutoToggle = () => {
    if (mode() === "auto") {
      saveMode("balanced");
    } else {
      setAdvancedOpen(false);
      saveMode("auto");
    }
  };

  const handlePreset = (key: "turbo" | "balanced" | "safe") => {
    if (advancedOpen()) setAdvancedOpen(false);
    saveMode(key);
  };

  const handleAdvancedToggle = () => {
    const opening = !advancedOpen();
    setAdvancedOpen(opening);
    if (opening) {
      saveMode("custom");
      requestAnimationFrame(() => {
        updateTrackFill(delayRef, customDelay(), 50, 1000);
        updateTrackFill(batchRef, customBatch(), 5, 50);
      });
    } else {
      saveMode("balanced");
    }
  };

  const handleDelayChange = async (value: number) => {
    setCustomDelay(value);
    updateTrackFill(delayRef, value, 50, 1000);
    await customDelayItem.setValue(value);
    flashSaved();
  };

  const handleBatchChange = async (value: number) => {
    setCustomBatch(value);
    updateTrackFill(batchRef, value, 5, 50);
    await customBatchSizeItem.setValue(value);
    flashSaved();
  };

  const isAuto = () => mode() === "auto";
  const isPreset = (key: string) => mode() === key;

  return (<div class="max-w-80 mx-auto p-4 font-sans">
    {/* Header */}
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

    {/* Speed mode card */}
    <div class="overflow-hidden rounded-[10px] bg-surface/50 ring-1 ring-ink/5">
      <div class="p-4">
        {/* Auto toggle row */}
        <div class="flex items-center justify-between">
          <h2 class="text-[13px] font-medium text-ink">Speed mode</h2>
          <label class="flex items-center gap-2 cursor-pointer" onClick={handleAutoToggle}>
            <span class="text-[11px] font-medium text-ink-muted">Auto</span>
            <div
              class="relative w-9 h-5 rounded-full transition-colors duration-200"
              classList={{
                "bg-brand": isAuto(),
                "bg-surface-hover": !isAuto(),
              }}
            >
              <div
                class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                classList={{ "translate-x-4": isAuto() }}
              />
            </div>
          </label>
        </div>

        {/* Auto description */}
        <Show when={isAuto()}>
          <p class="mt-2.5 text-[11px] leading-relaxed text-ink-muted/60">
            Automatically adjusts speed based on course size. Recommended for most users.
          </p>
        </Show>

        {/* Presets */}
        <Show when={!isAuto()}>
          <div class="mt-3 flex flex-col gap-1.5">
            {PRESET_OPTIONS.map(({ key, name, desc }) => (
              <button
                onClick={() => handlePreset(key)}
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
                classList={{
                  "ring-2 ring-brand bg-brand-soft/30": isPreset(key) && !advancedOpen(),
                  "ring-1 ring-ink/5 bg-white hover:bg-surface": !isPreset(key) || advancedOpen(),
                }}
              >
                <div
                  class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                  classList={{
                    "border-brand": isPreset(key) && !advancedOpen(),
                    "border-surface-hover": !isPreset(key) || advancedOpen(),
                  }}
                >
                  <div
                    class="w-2 h-2 rounded-full transition-colors"
                    classList={{
                      "bg-brand": isPreset(key) && !advancedOpen(),
                      "bg-transparent": !isPreset(key) || advancedOpen(),
                    }}
                  />
                </div>
                <div>
                  <div class="text-[12px] font-semibold text-ink">{name}</div>
                  <div class="text-[10px] text-ink-muted mt-0.5">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Show>
      </div>
    </div>

    {/* Advanced toggle */}
    <Show when={!isAuto()}>
      <div class="mt-2 text-center">
        <button
          onClick={handleAdvancedToggle}
          class="text-[11px] text-ink-muted/50 hover:text-ink-muted transition-colors px-2 py-1"
        >
          Advanced {advancedOpen() ? "\u25B4" : "\u25BE"}
        </button>
      </div>
    </Show>

    {/* Advanced panel */}
    <Show when={advancedOpen()}>
      <div class="mt-2 overflow-hidden rounded-[10px] bg-surface/50 ring-1 ring-ink/5">
        <div class="p-4">
          {/* Delay slider */}
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] text-ink-muted">Action delay</span>
              <span class="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink/65 ring-1 ring-ink/5">
                {customDelay()}ms
              </span>
            </div>
            <input
              ref={delayRef}
              type="range"
              min="50"
              max="1000"
              step="50"
              value={customDelay()}
              onInput={(e) => handleDelayChange(Number(e.currentTarget.value))}
              class="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand"
            />
            <div class="mt-1 flex justify-between text-[10px] font-medium text-ink-muted/40">
              <span>50ms</span>
              <span>1000ms</span>
            </div>
          </div>

          {/* Batch slider */}
          <div class="mt-4">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] text-ink-muted">Batch size</span>
              <span class="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink/65 ring-1 ring-ink/5">
                {customBatch()}
              </span>
            </div>
            <input
              ref={batchRef}
              type="range"
              min="5"
              max="50"
              step="5"
              value={customBatch()}
              onInput={(e) => handleBatchChange(Number(e.currentTarget.value))}
              class="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand"
            />
            <div class="mt-1 flex justify-between text-[10px] font-medium text-ink-muted/40">
              <span>5</span>
              <span>50</span>
            </div>
          </div>
        </div>

        <div class="border-t border-ink/5 bg-surface/40 px-4 py-2.5">
          <p class="text-[11px] leading-relaxed text-ink-muted/60">
            Higher delay and smaller batch reduce the chance of unexpected logouts from Udemy.
          </p>
        </div>
      </div>
    </Show>

    {/* Reset to Auto */}
    <Show when={!isAuto()}>
      <button
        onClick={() => { setAdvancedOpen(false); saveMode("auto"); }}
        class="mt-2.5 w-full h-8 px-4 rounded-[10px] bg-surface text-[12px] font-medium text-ink-muted hover:bg-surface-hover active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
      >
        Reset to Auto
      </button>
    </Show>
  </div>);
}
