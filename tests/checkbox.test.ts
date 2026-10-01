// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Checkbox } from "@/components/ui/Checkbox";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

function render(element: ReturnType<typeof createElement>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(element));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("Checkbox hit area", () => {
  it("toggles the input when the wrapping label's hit area is clicked", () => {
    const onChange = vi.fn();
    const container = render(createElement(Checkbox, { checked: false, onChange }));

    act(() => container.querySelector("label")!.click());

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reaches a clickable parent once, through the input's click", () => {
    const onChange = vi.fn();
    const onParentClick = vi.fn();
    const container = render(
      createElement(
        "button",
        { type: "button", onClick: onParentClick },
        createElement(Checkbox, { checked: false, onChange }),
      ),
    );

    act(() => container.querySelector("label")!.click());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onParentClick).toHaveBeenCalledTimes(1);
  });
});
