import { createSignal, onMount } from "solid-js";

import { delayItem, DEFAULT_DELAY_MS } from "@/utils/storage";

import "~/assets/tailwind.css";

export default function App() {
  const [delay, setDelay] = createSignal(DEFAULT_DELAY_MS);

  onMount(async () => {
    const saved = await delayItem.getValue();
    setDelay(saved);
  });

  const handleChange = async (value: number) => {
    setDelay(value);
    await delayItem.setValue(value);
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-base-200">
      <div class="card bg-base-100 shadow-xl w-80">
        <div class="card-body">
          <h2 class="card-title">Settings</h2>

          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">
                Delay between actions: <strong>{delay()}ms</strong>
              </span>
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              value={delay()}
              onInput={(e) => handleChange(Number(e.currentTarget.value))}
              class="range range-sm"
            />
            <div class="flex justify-between text-xs px-1 mt-1">
              <span>50ms</span>
              <span>Fast</span>
              <span>Safe</span>
              <span>500ms</span>
            </div>
          </div>

          <p class="text-xs text-base-content/60 mt-4">
            Higher delay reduces the chance of being rate-limited by Udemy.
            If you experience logouts, increase this value.
          </p>
        </div>
      </div>
    </div>
  );
}
