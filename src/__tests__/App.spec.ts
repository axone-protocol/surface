import { describe, it, expect, vi } from "vitest";

import { mount } from "@vue/test-utils";
import App from "../App.vue";

describe("App", () => {
  it("renders the homepage shell", async () => {
    const matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMedia,
    });

    const wrapper = mount(App);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("AXONE / SURFACE");
    expect(wrapper.text()).toContain("GOVERN ACT");
    expect(wrapper.text()).toContain("EVENT STREAM");
    expect(wrapper.text()).toContain("axone-testnet");
    expect(wrapper.text()).toContain("axone-dendrite-2");
    expect(wrapper.text()).toContain("author");
    expect(wrapper.text()).toContain("tx");

    await wrapper.get(".network-trigger").trigger("click");
    expect(wrapper.text()).toContain("soon");
    expect(wrapper.text()).toContain("AXONE-1");
  });
});
