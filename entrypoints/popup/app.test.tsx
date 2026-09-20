import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { storage } from "wxt/utils/storage";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { completeUdemyProgress } from "@/content-scripts/complete-udemy-progress";
import { resetUdemyProgress } from "@/content-scripts/reset-udemy-progress";
import { DEFAULT_REVIEW_STATE, SNOOZE_MS, type ReviewState } from "@/utils/review";
import { modeItem, reviewStateItem, successCountItem } from "@/utils/storage";
import { ACTIVE_TAB_ID, mockPopupEnvironment, MANIFEST_VERSION } from "@/tests/helpers/popup";
import App from "./app";

const DAY = 86_400_000;

let env: ReturnType<typeof mockPopupEnvironment>;

const seed = async (patch: { successCount?: number; reviewState?: Partial<ReviewState> } = {}) => {
  if (patch.successCount !== undefined) await successCountItem.setValue(patch.successCount);
  if (patch.reviewState) await reviewStateItem.setValue({ ...DEFAULT_REVIEW_STATE, ...patch.reviewState });
};

/** onMount seeds the signals from storage; clicking before it settles is a race. */
const mount = async () => {
  const utils = render(() => <App />);
  await waitFor(() => expect(env.setUninstallURL).toHaveBeenCalled());
  return utils;
};

const clearButton = () => screen.getByRole("button", { name: "Clear Udemy progress" });
const completeButton = () => screen.getByRole("button", { name: "Mark all lessons as complete" });

beforeEach(async () => {
  await storage.clear("local");
  env = mockPopupEnvironment();
});

describe("first paint", () => {
  it("shows both actions in their resting state", async () => {
    await mount();
    expect(clearButton()).toHaveTextContent("Clear Progress");
    expect(completeButton()).toHaveTextContent("Mark All Complete");
    expect(clearButton()).not.toBeDisabled();
  });

  it("runs the storage migration before anything else", async () => {
    await storage.setItem("local:delay", 900);
    await mount();
    await waitFor(async () => expect(await modeItem.getValue()).toBe("safe"));
    expect(await storage.getItem("local:delay")).toBeNull();
  });

  it("counts every popup open", async () => {
    await mount();
    await waitFor(async () => expect(await storage.getItem("local:popupOpens")).toBe(1));
  });

  it("keeps counting across opens", async () => {
    await storage.setItem("local:popupOpens", 4);
    await mount();
    await waitFor(async () => expect(await storage.getItem("local:popupOpens")).toBe(5));
  });

  it("registers an uninstall survey carrying the current context", async () => {
    await modeItem.setValue("safe");
    await mount();

    await waitFor(() => expect(env.setUninstallURL).toHaveBeenCalled());
    const url = new URL(env.setUninstallURL.mock.calls.at(-1)![0] as string);
    expect(url.searchParams.get("source")).toBe("uninstall");
    expect(url.searchParams.get("version")).toBe(MANIFEST_VERSION);
    expect(url.searchParams.get("mode")).toBe("safe");
  });

  it("opens the settings page from the gear", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(env.openOptionsPage).toHaveBeenCalled();
  });
});

describe("clearing progress", () => {
  it("injects the reset script into the active tab", async () => {
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(env.executeScript).toHaveBeenCalled());
    const call = env.executeScript.mock.calls[0]![0] as { target: { tabId: number }; func: unknown };
    expect(call.target).toEqual({ tabId: ACTIVE_TAB_ID });
    expect(call.func).toBe(resetUdemyProgress);
  });

  it("passes the pacing profile the saved mode resolves to", async () => {
    await modeItem.setValue("safe");
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(env.executeScript).toHaveBeenCalled());
    const call = env.executeScript.mock.calls[0]![0] as { args: unknown[] };
    expect(call.args).toEqual([{ delayMs: 400, batchSize: 20, cooldownMs: 3000 }]);
  });

  it("passes the saved custom sliders through in custom mode", async () => {
    await modeItem.setValue("custom");
    await storage.setItem("local:customDelay", 500);
    await storage.setItem("local:customBatchSize", 15);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(env.executeScript).toHaveBeenCalled());
    const call = env.executeScript.mock.calls[0]![0] as { args: unknown[] };
    expect(call.args).toEqual([{ delayMs: 500, batchSize: 15, cooldownMs: 3000 }]);
  });

  it("reports success and banks it", async () => {
    env.succeedScriptWith(42);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(clearButton()).toHaveTextContent("Done"));
    await waitFor(async () => expect(await successCountItem.getValue()).toBe(1));
  });

  it("treats a script that answered nothing as a success", async () => {
    env.resolveScriptWith(undefined);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(clearButton()).toHaveTextContent("Done"));
  });

  it("shows the spinner and blocks both buttons while it runs", async () => {
    let release: ((value: unknown) => void) | null = null;
    env.executeScript.mockImplementation((() => new Promise((r) => { release = r; })) as never);

    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(env.executeScript).toHaveBeenCalled());
    expect(clearButton()).toHaveTextContent("Resetting...");
    expect(clearButton()).toHaveAttribute("aria-busy", "true");
    expect(clearButton()).toBeDisabled();
    expect(completeButton()).toBeDisabled();

    release!([{ result: { success: true, toggled: 1 } }]);
    await waitFor(() => expect(clearButton()).toHaveTextContent("Done"));
  });

  it("ignores a second click while a run is in flight", async () => {
    env.executeScript.mockImplementation(() => new Promise(() => {}) as never);
    await mount();

    fireEvent.click(clearButton());
    await waitFor(() => expect(env.executeScript).toHaveBeenCalledTimes(1));
    fireEvent.click(clearButton());
    fireEvent.click(completeButton());

    expect(env.executeScript).toHaveBeenCalledTimes(1);
  });
});

describe("marking everything complete", () => {
  it("injects the complete script", async () => {
    await mount();
    fireEvent.click(completeButton());

    await waitFor(() => expect(env.executeScript).toHaveBeenCalled());
    expect((env.executeScript.mock.calls[0]![0] as { func: unknown }).func).toBe(completeUdemyProgress);
  });

  it("reports on its own button, leaving the other one resting", async () => {
    env.succeedScriptWith(3);
    await mount();
    fireEvent.click(completeButton());

    await waitFor(() => expect(completeButton()).toHaveTextContent("Done"));
    expect(clearButton()).toHaveTextContent("Clear Progress");
  });

  it("banks its successes in the same counter", async () => {
    await seed({ successCount: 2 });
    env.succeedScriptWith(3);
    await mount();
    fireEvent.click(completeButton());

    await waitFor(async () => expect(await successCountItem.getValue()).toBe(3));
  });
});

describe("failures", () => {
  it.each([
    ["NO_CURRICULUM", "Open a Udemy course page first"],
    ["NO_SECTIONS", "No course sections found on this page"],
  ])("explains %s in the user's terms", async (error, message) => {
    env.failScriptWith(error);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
    expect(clearButton()).toHaveTextContent("Try Again");
  });

  it("falls back to a generic message for an error code it does not know", async () => {
    env.failScriptWith("SOMETHING_NEW");
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeInTheDocument());
  });

  it("says so when there is no tab to inject into", async () => {
    env = mockPopupEnvironment({ noTab: true });
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(screen.getByText("Cannot access the current tab")).toBeInTheDocument());
    expect(env.executeScript).not.toHaveBeenCalled();
  });

  it("points at Udemy when the injection itself is refused", async () => {
    env.throwOnExecute();
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(screen.getByText("Make sure you're on a Udemy page")).toBeInTheDocument());
  });

  it("does not bank a failed run", async () => {
    env.failScriptWith("NO_CURRICULUM");
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(clearButton()).toHaveTextContent("Try Again"));
    expect(await successCountItem.getValue()).toBe(0);
  });

  it("clears the previous error when the next run starts", async () => {
    env.failScriptWith("NO_CURRICULUM");
    await mount();
    fireEvent.click(clearButton());
    await waitFor(() => expect(screen.getByText("Open a Udemy course page first")).toBeInTheDocument());

    env.succeedScriptWith(1);
    fireEvent.click(clearButton());
    await waitFor(() => expect(screen.queryByText("Open a Udemy course page first")).not.toBeInTheDocument());
  });
});

describe("the button settling back down", () => {
  it("returns to its resting label after the done flash", async () => {
    vi.useFakeTimers();
    env.succeedScriptWith(1);
    render(() => <App />);
    await vi.waitFor(() => expect(env.setUninstallURL).toHaveBeenCalled());

    fireEvent.click(clearButton());
    await vi.waitFor(() => expect(clearButton()).toHaveTextContent("Done"));

    await vi.advanceTimersByTimeAsync(2000);
    expect(clearButton()).toHaveTextContent("Clear Progress");
    vi.useRealTimers();
  });

  it("clears the error banner along with the error state", async () => {
    vi.useFakeTimers();
    env.failScriptWith("NO_SECTIONS");
    render(() => <App />);
    await vi.waitFor(() => expect(env.setUninstallURL).toHaveBeenCalled());

    fireEvent.click(completeButton());
    await vi.waitFor(() => expect(screen.getByText("No course sections found on this page")).toBeInTheDocument());

    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.queryByText("No course sections found on this page")).not.toBeInTheDocument();
    expect(completeButton()).toHaveTextContent("Mark All Complete");
    vi.useRealTimers();
  });
});

describe("the review prompt gate", () => {
  const askQuestion = "How's Udemy Reset Progress working for you?";

  it("stays hidden on a first-ever run", async () => {
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(clearButton()).toHaveTextContent("Done"));
    expect(screen.queryByText(askQuestion)).not.toBeInTheDocument();
  });

  it("stamps the very first success so the age gate can start counting", async () => {
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(async () => expect((await reviewStateItem.getValue()).firstSuccessAt).toBeGreaterThan(0));
  });

  it("keeps the original stamp on later runs", async () => {
    const firstSuccessAt = Date.now() - 3 * DAY;
    await seed({ successCount: 1, reviewState: { firstSuccessAt } });
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(clearButton()).toHaveTextContent("Done"));
    expect((await reviewStateItem.getValue()).firstSuccessAt).toBe(firstSuccessAt);
  });

  it("asks once the user has succeeded twice on a day-old install", async () => {
    await seed({ successCount: 1, reviewState: { firstSuccessAt: Date.now() - 2 * DAY } });
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(screen.getByText(askQuestion)).toBeInTheDocument());
  });

  it("asks a heavy same-day user without waiting a day", async () => {
    await seed({ successCount: 3, reviewState: { firstSuccessAt: Date.now() } });
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(screen.getByText(askQuestion)).toBeInTheDocument());
  });

  it("stays quiet during a snooze", async () => {
    await seed({
      successCount: 5,
      reviewState: { firstSuccessAt: Date.now() - 5 * DAY, promptCount: 1, snoozeUntil: Date.now() + SNOOZE_MS },
    });
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(clearButton()).toHaveTextContent("Done"));
    expect(screen.queryByText(askQuestion)).not.toBeInTheDocument();
  });

  it("never asks someone who already answered", async () => {
    await seed({
      successCount: 9,
      reviewState: { stage: "feedback", lastSentiment: "bad", promptCount: 1, firstSuccessAt: Date.now() - 9 * DAY },
    });
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(clearButton()).toHaveTextContent("Done"));
    expect(screen.queryByText(askQuestion)).not.toBeInTheDocument();
  });

  it("also opens after a successful complete run", async () => {
    await seed({ successCount: 3, reviewState: { firstSuccessAt: Date.now() } });
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(completeButton());

    await waitFor(() => expect(screen.getByText(askQuestion)).toBeInTheDocument());
  });

  it("can be forced open from the dev console while developing", async () => {
    await storage.setItem("local:devForceReview", true);
    await mount();
    await waitFor(() => expect(screen.getByText(askQuestion)).toBeInTheDocument());
  });

  it("does not open after a failed run", async () => {
    await seed({ successCount: 5, reviewState: { firstSuccessAt: Date.now() - 5 * DAY } });
    env.failScriptWith("NO_CURRICULUM");
    await mount();
    fireEvent.click(clearButton());

    await waitFor(() => expect(clearButton()).toHaveTextContent("Try Again"));
    expect(screen.queryByText(askQuestion)).not.toBeInTheDocument();
  });
});

describe("recording the review answer", () => {
  const arm = async () => {
    await seed({ successCount: 3, reviewState: { firstSuccessAt: Date.now() } });
    env.succeedScriptWith(1);
    await mount();
    fireEvent.click(clearButton());
    await waitFor(() => expect(screen.getByText("How's Udemy Reset Progress working for you?")).toBeInTheDocument());
  };

  it("persists a dismissal as a snooze that keeps the door open", async () => {
    await arm();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(async () => {
      const state = await reviewStateItem.getValue();
      expect(state).toMatchObject({ stage: "idle", promptCount: 1 });
      expect(state.snoozeUntil).toBeGreaterThan(Date.now());
    });
  });

  it("persists a rating as final", async () => {
    vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue({} as never);
    await arm();
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    fireEvent.click(screen.getByRole("button", { name: /^Rate on/ }));

    await waitFor(async () => expect(await reviewStateItem.getValue())
      .toMatchObject({ stage: "rated", lastSentiment: "great", promptCount: 1 }));
  });

  it("persists a report as final, with the sentiment that triggered it", async () => {
    vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue({} as never);
    await arm();
    fireEvent.click(screen.getByRole("button", { name: "Bad" }));
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(async () => expect(await reviewStateItem.getValue())
      .toMatchObject({ stage: "feedback", lastSentiment: "bad", promptCount: 1 }));
  });

  it("hands the prompt the live context the report needs", async () => {
    await modeItem.setValue("turbo");
    const create = vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue({} as never);
    await arm();
    fireEvent.click(screen.getByRole("button", { name: "Bad" }));
    fireEvent.click(screen.getByRole("button", { name: "Something else" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    const url = new URL((create.mock.calls[0]![0] as { url: string }).url);
    expect(url.searchParams.get("version")).toBe(MANIFEST_VERSION);
    expect(url.searchParams.get("mode")).toBe("turbo");
  });
});

describe("the footer", () => {
  it("promotes the extension once the user is clearly getting value from it", async () => {
    await seed({ successCount: 3 });
    await mount();
    expect(screen.getByRole("button", { name: "Share with a friend" })).toBeInTheDocument();
  });

  it("stays a plain author link before that", async () => {
    await seed({ successCount: 2 });
    await mount();
    expect(screen.queryByRole("button", { name: "Share with a friend" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "shramko.dev" })).toBeInTheDocument();
  });

  it("stops nagging someone who already answered the prompt", async () => {
    await seed({ successCount: 9, reviewState: { stage: "rated", lastSentiment: "great", promptCount: 1 } });
    await mount();
    expect(screen.queryByRole("button", { name: "Share with a friend" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "shramko.dev" })).toBeInTheDocument();
  });

  it("appears as soon as the third run lands, without reopening the popup", async () => {
    await seed({ successCount: 2, reviewState: { firstSuccessAt: Date.now() } });
    env.succeedScriptWith(1);
    await mount();
    expect(screen.queryByRole("button", { name: "Share with a friend" })).not.toBeInTheDocument();

    fireEvent.click(clearButton());
    await waitFor(() => expect(screen.getByRole("button", { name: "Share with a friend" })).toBeInTheDocument());
  });

  it("copies the store link and confirms it", async () => {
    vi.useFakeTimers();
    await seed({ successCount: 3 });
    render(() => <App />);
    await vi.waitFor(() => expect(env.setUninstallURL).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Share with a friend" }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Link copied!" })).toBeInTheDocument());
    expect(env.writeText).toHaveBeenCalledWith(
      "https://chromewebstore.google.com/detail/udemy-reset-progress/dddnklikfgdefjekcbhehjogkpfkbdlo",
    );

    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.getByRole("button", { name: "Share with a friend" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("links out to the author's site in a new tab", async () => {
    await mount();
    const link = screen.getByRole("link", { name: "shramko.dev" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("href")).toContain("utm_source=udemy-reset-progress");
  });
});

