import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";

import App from "../App.vue";

function createEmptyTxList() {
  return { tx_responses: [] };
}

describe("App", () => {
  it("renders the live act homepage shell", async () => {
    const matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => createEmptyTxList(),
    }));

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMedia,
    });
    Object.defineProperty(window, "fetch", {
      writable: true,
      value: fetchMock,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      writable: true,
      value: vi.fn().mockReturnValue({
        setTransform: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
      }),
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("AXONE / SURFACE");
    expect(wrapper.text()).toContain("GOVERN ACT");
    expect(wrapper.text()).toContain("Connect identity");
    expect(wrapper.text()).toContain("axone-testnet");
    expect(wrapper.text()).toContain("CHAIN REGISTER");
    expect(wrapper.text()).toContain("Enter the surface");
    expect(wrapper.text()).toContain("0 RECORDS");
    expect(wrapper.text()).not.toContain("Awaiting");

    await wrapper.get(".network-trigger").trigger("click");
    expect(wrapper.text()).toContain("AXONE-1");
    expect(wrapper.text()).toContain("soon");
  });

  it("does not show a zero-count heartbeat when the chain request fails", async () => {
    const matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMedia,
    });
    Object.defineProperty(window, "fetch", {
      writable: true,
      value: fetchMock,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      writable: true,
      value: vi.fn().mockReturnValue({
        setTransform: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
      }),
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("CHAIN UNAVAILABLE");
    expect(wrapper.text()).not.toContain("0 RECORDS");
  });
});
