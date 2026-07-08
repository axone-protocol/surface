import { describe, it, expect } from "vitest";

import { mount } from "@vue/test-utils";
import App from "../App.vue";

describe("App", () => {
  it("renders the homepage shell", () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain("AXONE / SURFACE");
    expect(wrapper.text()).toContain("GOVERN ACT");
  });
});
