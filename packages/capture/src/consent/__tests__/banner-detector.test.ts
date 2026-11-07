import { describe, it, expect } from "vitest";
import { classifyButtonText } from "../banner-detector";

describe("Banner Detector", () => {
  describe("classifyButtonText", () => {
    it("correctly identifies accept button phrases", () => {
      expect(classifyButtonText("Accept All")).toBe("accept");
      expect(classifyButtonText("Allow all cookies")).toBe("accept");
      expect(classifyButtonText("I agree")).toBe("accept");
      expect(classifyButtonText("Accept")).toBe("accept");
      expect(classifyButtonText("OK")).toBe("accept");
      expect(classifyButtonText("Got it")).toBe("accept");
    });

    it("correctly identifies reject button phrases", () => {
      expect(classifyButtonText("Reject All")).toBe("reject");
      expect(classifyButtonText("Decline All")).toBe("reject");
      expect(classifyButtonText("Decline")).toBe("reject");
      expect(classifyButtonText("Only Essential")).toBe("reject");
      expect(classifyButtonText("Necessary Only")).toBe("reject");
      expect(classifyButtonText("Reject Non-Essential")).toBe("reject");
      expect(classifyButtonText("Continue without accepting")).toBe("reject");
      expect(classifyButtonText("Save preferences")).toBe("reject");
    });

    it("correctly identifies preferences / settings button phrases", () => {
      expect(classifyButtonText("Cookie Settings")).toBe("preferences");
      expect(classifyButtonText("Customize")).toBe("preferences");
      expect(classifyButtonText("Preferences")).toBe("preferences");
      expect(classifyButtonText("Manage options")).toBe("preferences");
    });

    it("correctly identifies close / dismiss button phrases", () => {
      expect(classifyButtonText("X")).toBe("close");
      expect(classifyButtonText("Close")).toBe("close");
      expect(classifyButtonText("Dismiss")).toBe("close");
    });

    it("classifies unrecognized button text as unknown", () => {
      expect(classifyButtonText("Read More")).toBe("unknown");
      expect(classifyButtonText("Submit")).toBe("unknown");
    });
  });
});
