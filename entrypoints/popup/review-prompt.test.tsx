import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { MAX_COMMENT_LENGTH } from "@/utils/review";
import ReviewPrompt, { type ReviewResolution } from "./review-prompt";

const CONTEXT = {
  version: "2.1.0", browserName: "Chrome", mode: "balanced",
  reviewUrl: "https://chromewebstore.google.com/detail/x/reviews",
};

function setup(context: Partial<typeof CONTEXT> = {}) {
  const onResolve = vi.fn<(r: ReviewResolution) => Promise<void>>(async () => {});
  const onClose = vi.fn();
  const createTab = vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue({} as never);

  const utils = render(() => (
    <ReviewPrompt context={{ ...CONTEXT, ...context }} onResolve={onResolve} onClose={onClose} />
  ));

  return { ...utils, onResolve, onClose, createTab };
}

const openImprove = (sentiment: "Okay" | "Bad" = "Bad") => {
  const api = setup();
  fireEvent.click(screen.getByRole("button", { name: sentiment }));
  return api;
};

describe("the opening question", () => {
  it("asks once, with all three answers", () => {
    setup();
    expect(screen.getByText("How's Udemy Reset Progress working for you?")).toBeInTheDocument();
    for (const label of ["Bad", "Okay", "Great"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("is labelled as a feedback group for screen readers", () => {
    setup();
    expect(screen.getByRole("group", { name: "Feedback" })).toBeInTheDocument();
  });

  it("sends a happy user to the store pitch", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    expect(screen.getByText("Glad to hear it!")).toBeInTheDocument();
  });

  it.each(["Okay", "Bad"] as const)("sends a %s rating to the report flow", (label) => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByText("Sorry about that. What went wrong?")).toBeInTheDocument();
  });

  it("only records one dismissal however often Not now is clicked", async () => {
    const { onResolve } = setup();
    const notNow = screen.getByRole("button", { name: "Not now" });
    fireEvent.click(notNow);
    fireEvent.click(notNow);

    await waitFor(() => expect(onResolve).toHaveBeenCalledTimes(1));
  });

  it("dismisses without opening anything when the close button is used", async () => {
    const { onResolve, onClose, createTab } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ kind: "dismissed" }));
    expect(onClose).toHaveBeenCalled();
    expect(createTab).not.toHaveBeenCalled();
  });
});

describe("the promoter path", () => {
  it("names the store the user actually installed from", () => {
    setup({ browserName: "Firefox" });
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    expect(screen.getByRole("button", { name: "Rate on Firefox Add-ons" })).toBeInTheDocument();
  });

  it("names the Chrome Web Store everywhere else", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    expect(screen.getByRole("button", { name: "Rate on Chrome Web Store" })).toBeInTheDocument();
  });

  it("records the rating before opening the store, because the popup dies on tab open", async () => {
    const calls: string[] = [];
    const onResolve = vi.fn(async () => { calls.push("resolve"); });
    const createTab = vi.spyOn(fakeBrowser.tabs, "create")
      .mockImplementation(async () => { calls.push("tab"); return {} as never; });

    render(() => <ReviewPrompt context={CONTEXT} onResolve={onResolve} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    fireEvent.click(screen.getByRole("button", { name: /^Rate on/ }));

    await waitFor(() => expect(createTab).toHaveBeenCalled());
    expect(calls).toEqual(["resolve", "tab"]);
    expect(onResolve).toHaveBeenCalledWith({ kind: "rated" });
  });

  it("opens the review page, not the listing page", async () => {
    const { createTab } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    fireEvent.click(screen.getByRole("button", { name: /^Rate on/ }));

    await waitFor(() => expect(createTab).toHaveBeenCalledWith({ url: CONTEXT.reviewUrl }));
  });

  it("thanks the user and closes itself afterwards", async () => {
    vi.useFakeTimers();
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    fireEvent.click(screen.getByRole("button", { name: /^Rate on/ }));

    await vi.waitFor(() => expect(screen.getByText("Thanks — that really helps.")).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2500);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("still lets a happy user decline", async () => {
    const { onResolve, createTab } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ kind: "dismissed" }));
    expect(createTab).not.toHaveBeenCalled();
  });

  it("ignores a second click while the first one is in flight", async () => {
    const { createTab } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    const rate = screen.getByRole("button", { name: /^Rate on/ });
    fireEvent.click(rate);
    fireEvent.click(rate);

    await waitFor(() => expect(createTab).toHaveBeenCalledTimes(1));
  });
});

describe("the detractor path", () => {
  it("hides the comment box until a reason is chosen", () => {
    openImprove();
    expect(screen.queryByPlaceholderText("Anything else? (optional)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    expect(screen.getByPlaceholderText("Anything else? (optional)")).toBeInTheDocument();
  });

  it("offers every reason the extension knows about", () => {
    openImprove();
    for (const label of ["Didn't work", "Slow / logged out", "Missing a feature", "Something else"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the chosen reason as pressed, and only that one", () => {
    openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Missing a feature" }));

    expect(screen.getByRole("button", { name: "Missing a feature" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Didn't work" })).toHaveAttribute("aria-pressed", "false");
  });

  it("lets the user change their mind about the reason", () => {
    openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    fireEvent.click(screen.getByRole("button", { name: "Something else" }));

    expect(screen.getByRole("button", { name: "Something else" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Didn't work" })).toHaveAttribute("aria-pressed", "false");
  });

  it("caps the comment at the length the form accepts", () => {
    openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    expect(screen.getByPlaceholderText("Anything else? (optional)"))
      .toHaveAttribute("maxlength", String(MAX_COMMENT_LENGTH));
  });

  it("carries the rating, reason, comment and context into the form URL", async () => {
    const { createTab, onResolve } = openImprove("Okay");
    fireEvent.click(screen.getByRole("button", { name: "Slow / logged out" }));
    fireEvent.input(screen.getByPlaceholderText("Anything else? (optional)"), {
      target: { value: "Udemy logged me out" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(createTab).toHaveBeenCalled());
    const url = new URL(createTab.mock.calls[0]![0]!.url!);
    expect(url.searchParams.get("rating")).toBe("meh");
    expect(url.searchParams.get("reason")).toBe("Slow / logged out");
    expect(url.searchParams.get("comment")).toBe("Udemy logged me out");
    expect(url.searchParams.get("version")).toBe("2.1.0");
    expect(url.searchParams.get("browser")).toBe("Chrome");
    expect(url.searchParams.get("mode")).toBe("balanced");

    expect(onResolve).toHaveBeenCalledWith({
      kind: "feedback", sentiment: "meh", reason: "rate-limited", comment: "Udemy logged me out",
    });
  });

  it("sends a report with no comment at all", async () => {
    const { createTab, onResolve } = openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Something else" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({
      kind: "feedback", sentiment: "bad", reason: "other", comment: "",
    }));
    expect(new URL(createTab.mock.calls[0]![0]!.url!).searchParams.get("comment")).toBe("");
  });

  it("offers email as an alternative destination", async () => {
    const { createTab } = openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    fireEvent.click(screen.getByRole("button", { name: "email" }));

    await waitFor(() => expect(createTab).toHaveBeenCalled());
    expect(createTab.mock.calls[0]![0]!.url!).toMatch(/^mailto:shramko\.dev@gmail\.com\?/);
  });

  it("opens one destination even when the email link is clicked twice", async () => {
    const { createTab } = openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    const email = screen.getByRole("button", { name: "email" });
    fireEvent.click(email);
    fireEvent.click(email);

    await waitFor(() => expect(createTab).toHaveBeenCalledTimes(1));
  });

  it("offers GitHub as an alternative destination", async () => {
    const { createTab } = openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    fireEvent.click(screen.getByRole("button", { name: "GitHub" }));

    await waitFor(() => expect(createTab).toHaveBeenCalled());
    expect(createTab.mock.calls[0]![0]!.url!)
      .toMatch(/^https:\/\/github\.com\/Shramkoweb\/udemy-reset-progress\/issues\/new\?/);
  });

  it("explains that the form needs no account", () => {
    openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    expect(screen.getByText(/no account needed/)).toBeInTheDocument();
  });

  it("thanks the user after a report and closes itself", async () => {
    vi.useFakeTimers();
    const { onClose } = openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await vi.waitFor(() => expect(screen.getByText("Thanks — that really helps.")).toBeInTheDocument());
    vi.advanceTimersByTime(2500);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("lets an unhappy user walk away without reporting", async () => {
    const { onResolve, createTab } = openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ kind: "dismissed" }));
    expect(createTab).not.toHaveBeenCalled();
  });

  it("only submits once however often Send is clicked", async () => {
    const { createTab } = openImprove();
    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    const send = screen.getByRole("button", { name: "Send feedback" });
    fireEvent.click(send);
    fireEvent.click(send);
    fireEvent.click(send);

    await waitFor(() => expect(createTab).toHaveBeenCalledTimes(1));
  });
});

describe("cleanup", () => {
  it("drops the auto-close timer when the popup unmounts first", async () => {
    vi.useFakeTimers();
    const { onClose, unmount } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    fireEvent.click(screen.getByRole("button", { name: /^Rate on/ }));

    await vi.waitFor(() => expect(screen.getByText("Thanks — that really helps.")).toBeInTheDocument());
    unmount();
    vi.advanceTimersByTime(10_000);

    expect(onClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
