import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { storage } from "wxt/utils/storage";

import type { Mode } from "@/utils/pacing";
import { customBatchSizeItem, customDelayItem, modeItem } from "@/utils/storage";
import App from "./app";

/** onMount writes storage into the signals after first paint; an earlier click is undone. */
let lastStorageRead: MockInstance<typeof customBatchSizeItem.getValue>;

const mount = async (mode?: Mode) => {
  if (mode) await modeItem.setValue(mode);
  const utils = render(() => <App />);
  await waitFor(() => expect(lastStorageRead).toHaveResolved());
  return utils;
};

const autoToggle = () => screen.getByText("Auto");
const preset = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const sliders = () => screen.getAllByRole("slider") as HTMLInputElement[];
const savedBadge = () => screen.getByText("Saved");

const settleMode = async (expected: Mode) => waitFor(async () => expect(await modeItem.getValue()).toBe(expected));

beforeEach(async () => {
  await storage.clear("local");
  lastStorageRead = vi.spyOn(customBatchSizeItem, "getValue");
});

describe("opening the settings", () => {
  it("starts on Auto and hides the presets behind it", async () => {
    await mount();
    expect(screen.getByText(/Automatically adjusts speed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Balanced/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset to Auto" })).not.toBeInTheDocument();
  });

  it("shows the presets when a manual mode was saved", async () => {
    await mount("safe");
    for (const name of ["Turbo", "Balanced", "Safe"]) {
      expect(preset(name)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Automatically adjusts speed/)).not.toBeInTheDocument();
  });

  it("opens the advanced panel straight away for a custom setup", async () => {
    await modeItem.setValue("custom");
    await customDelayItem.setValue(600);
    await customBatchSizeItem.setValue(20);
    await mount();

    await waitFor(() => expect(screen.getByText("600ms")).toBeInTheDocument());
    expect(screen.getByText("Action delay")).toBeInTheDocument();
    expect(screen.getByText("Batch size")).toBeInTheDocument();
  });

  it("keeps the advanced panel shut for a preset mode", async () => {
    await mount("balanced");
    expect(screen.queryByText("Action delay")).not.toBeInTheDocument();
  });

  it("shows the saved slider values rather than the defaults", async () => {
    await modeItem.setValue("custom");
    await customDelayItem.setValue(950);
    await customBatchSizeItem.setValue(45);
    await mount();

    await waitFor(() => expect(screen.getByText("950ms")).toBeInTheDocument());
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(sliders().map((s) => s.value)).toEqual(["950", "45"]);
  });

  it("paints the filled part of each slider track", async () => {
    await modeItem.setValue("custom");
    await customDelayItem.setValue(525);
    await mount();

    await waitFor(() => expect(sliders()[0]!.style.background).toContain("linear-gradient"));
    expect(sliders()[0]!.style.background).toContain("50%");
  });

  it("gives each slider a name a screen reader can announce", async () => {
    await mount("custom");
    await waitFor(() => expect(sliders()).toHaveLength(2));

    expect(screen.getByRole("slider", { name: "Action delay" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Batch size" })).toBeInTheDocument();
  });

  it("keeps the slider ranges in step with what custom mode accepts", async () => {
    await mount("custom");
    await waitFor(() => expect(sliders()).toHaveLength(2));
    const [delay, batch] = sliders();

    expect([delay!.min, delay!.max, delay!.step]).toEqual(["50", "1000", "50"]);
    expect([batch!.min, batch!.max, batch!.step]).toEqual(["5", "50", "5"]);
  });
});

describe("the auto switch", () => {
  it("drops to Balanced and reveals the presets when switched off", async () => {
    await mount();
    fireEvent.click(autoToggle());

    await settleMode("balanced");
    expect(preset("Balanced")).toBeInTheDocument();
  });

  it("goes back to Auto and hides the presets when switched on", async () => {
    await mount("turbo");
    fireEvent.click(autoToggle());

    await settleMode("auto");
    await waitFor(() => expect(screen.getByText(/Automatically adjusts speed/)).toBeInTheDocument());
  });

  it("closes the advanced panel on the way back to Auto", async () => {
    await mount("custom");
    await waitFor(() => expect(screen.getByText("Action delay")).toBeInTheDocument());

    fireEvent.click(autoToggle());
    await settleMode("auto");
    expect(screen.queryByText("Action delay")).not.toBeInTheDocument();
  });
});

describe("the presets", () => {
  it.each([
    ["Turbo", "turbo"],
    ["Balanced", "balanced"],
    ["Safe", "safe"],
  ] as const)("saves %s straight away", async (label, mode) => {
    await mount("balanced");
    fireEvent.click(preset(label));
    await settleMode(mode);
  });

  it("marks only the chosen preset as selected", async () => {
    await mount("balanced");
    fireEvent.click(preset("Safe"));
    await settleMode("safe");

    expect(preset("Safe").className).toContain("ring-brand");
    expect(preset("Turbo").className).not.toContain("ring-brand");
  });

  it("describes what each preset is for", async () => {
    await mount("balanced");
    expect(screen.getByText("Fastest speed for small courses")).toBeInTheDocument();
    expect(screen.getByText("Recommended for most courses")).toBeInTheDocument();
    expect(screen.getByText("Reliable for large courses")).toBeInTheDocument();
  });

  it("closes the advanced panel when a preset takes over", async () => {
    await mount("custom");
    await waitFor(() => expect(screen.getByText("Action delay")).toBeInTheDocument());

    fireEvent.click(preset("Turbo"));
    await settleMode("turbo");
    expect(screen.queryByText("Action delay")).not.toBeInTheDocument();
  });

  it("leaves no preset highlighted while the custom panel is open", async () => {
    await mount("custom");
    await waitFor(() => expect(screen.getByText("Action delay")).toBeInTheDocument());

    for (const name of ["Turbo", "Balanced", "Safe"]) {
      expect(preset(name).className).not.toContain("ring-brand");
    }
  });
});

describe("the advanced panel", () => {
  it("is only offered once Auto is off", async () => {
    await mount();
    expect(screen.queryByRole("button", { name: /^Advanced/ })).not.toBeInTheDocument();

    fireEvent.click(autoToggle());
    await waitFor(() => expect(screen.getByRole("button", { name: /^Advanced/ })).toBeInTheDocument());
  });

  it("switches the mode to custom when opened", async () => {
    await mount("balanced");
    fireEvent.click(screen.getByRole("button", { name: /^Advanced/ }));

    await settleMode("custom");
    expect(screen.getByText("Action delay")).toBeInTheDocument();
  });

  it("falls back to Balanced when closed again", async () => {
    await mount("custom");
    await waitFor(() => expect(screen.getByText("Action delay")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^Advanced/ }));
    await settleMode("balanced");
    expect(screen.queryByText("Action delay")).not.toBeInTheDocument();
  });

  it("flips its caret with the panel", async () => {
    await mount("balanced");
    expect(screen.getByRole("button", { name: /^Advanced/ }).textContent).toContain("▾");

    fireEvent.click(screen.getByRole("button", { name: /^Advanced/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Advanced/ }).textContent).toContain("▴"));
  });

  it("saves and echoes a new delay", async () => {
    await mount("custom");
    await waitFor(() => expect(sliders()).toHaveLength(2));

    fireEvent.input(sliders()[0]!, { target: { value: "800" } });

    await waitFor(async () => expect(await customDelayItem.getValue()).toBe(800));
    expect(screen.getByText("800ms")).toBeInTheDocument();
  });

  it("saves and echoes a new batch size", async () => {
    await mount("custom");
    await waitFor(() => expect(sliders()).toHaveLength(2));

    fireEvent.input(sliders()[1]!, { target: { value: "10" } });

    await waitFor(async () => expect(await customBatchSizeItem.getValue()).toBe(10));
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("repaints the track as the delay moves", async () => {
    await mount("custom");
    await waitFor(() => expect(sliders()).toHaveLength(2));

    fireEvent.input(sliders()[0]!, { target: { value: "50" } });
    await waitFor(() => expect(sliders()[0]!.style.background).toContain("0%"));

    fireEvent.input(sliders()[0]!, { target: { value: "1000" } });
    await waitFor(() => expect(sliders()[0]!.style.background).toContain("100%"));
  });

  it("does not knock the mode off custom when a slider moves", async () => {
    await mount("custom");
    await waitFor(() => expect(sliders()).toHaveLength(2));

    fireEvent.input(sliders()[0]!, { target: { value: "300" } });
    await waitFor(async () => expect(await customDelayItem.getValue()).toBe(300));
    expect(await modeItem.getValue()).toBe("custom");
  });

  it("warns what the sliders actually trade off", async () => {
    await mount("custom");
    await waitFor(() => expect(screen.getByText(/reduce the chance of unexpected logouts/)).toBeInTheDocument());
  });

  it("keeps the custom values when the panel is closed and reopened", async () => {
    await mount("custom");
    await waitFor(() => expect(sliders()).toHaveLength(2));
    fireEvent.input(sliders()[0]!, { target: { value: "700" } });
    await waitFor(async () => expect(await customDelayItem.getValue()).toBe(700));

    fireEvent.click(screen.getByRole("button", { name: /^Advanced/ }));
    await settleMode("balanced");
    fireEvent.click(screen.getByRole("button", { name: /^Advanced/ }));

    await waitFor(() => expect(screen.getByText("700ms")).toBeInTheDocument());
  });
});

describe("Reset to Auto", () => {
  it("is offered for every manual mode", async () => {
    await mount("turbo");
    expect(screen.getByRole("button", { name: "Reset to Auto" })).toBeInTheDocument();
  });

  it("puts everything back and closes the advanced panel", async () => {
    await mount("custom");
    await waitFor(() => expect(screen.getByText("Action delay")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Reset to Auto" }));

    await settleMode("auto");
    expect(screen.queryByText("Action delay")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset to Auto" })).not.toBeInTheDocument();
  });

  it("leaves the custom slider values alone for next time", async () => {
    await modeItem.setValue("custom");
    await customDelayItem.setValue(450);
    await mount();
    await waitFor(() => expect(screen.getByText("450ms")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Reset to Auto" }));
    await settleMode("auto");
    expect(await customDelayItem.getValue()).toBe(450);
  });
});

describe("the saved indicator", () => {
  it("is invisible until something is saved", async () => {
    await mount();
    expect(savedBadge().className).toContain("opacity-0");
  });

  it("flashes on a save and fades back out", async () => {
    await mount("balanced");
    vi.useFakeTimers();

    fireEvent.click(preset("Safe"));
    await vi.waitFor(() => expect(savedBadge().className).toContain("opacity-100"));

    await vi.advanceTimersByTimeAsync(1500);
    expect(savedBadge().className).toContain("opacity-0");
    vi.useRealTimers();
  });
});

describe("the always-available links", () => {
  it("offers a direct route to the store review page", async () => {
    await mount();
    const rate = screen.getByRole("link", { name: /Rate/ });
    expect(rate).toHaveAttribute("target", "_blank");
    expect(rate.getAttribute("href")).toContain("/reviews");
  });

  it("offers a direct route to the feedback form", async () => {
    await mount();
    const feedback = screen.getByRole("link", { name: "Send feedback" });
    expect(feedback).toHaveAttribute("target", "_blank");
    expect(feedback.getAttribute("href")).toMatch(/^https:\/\/tally\.so\/r\//);
  });

  it("does not hand either opened tab a reference back to the settings page", async () => {
    await mount();
    for (const name of [/Rate/, "Send feedback"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("keeps both routes visible in every mode", async () => {
    for (const mode of ["auto", "turbo", "custom"] as const) {
      await storage.clear("local");
      const { unmount } = await mount(mode);
      expect(screen.getByRole("link", { name: /Rate/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Send feedback" })).toBeInTheDocument();
      unmount();
    }
  });
});
