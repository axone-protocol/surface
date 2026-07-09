import { describe, it, expect, vi } from "vitest";

import { mount } from "@vue/test-utils";
import App from "../App.vue";

describe("App", () => {
  it("renders the homepage shell", () => {
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
    expect(wrapper.text()).toContain("AXONE / SURFACE");
    expect(wrapper.text()).toContain("GOVERN ACT");
    expect(wrapper.text()).toContain("EVENT STREAM");
    expect(wrapper.text()).toContain("author");
    expect(wrapper.text()).toContain("tx");
  });
});
