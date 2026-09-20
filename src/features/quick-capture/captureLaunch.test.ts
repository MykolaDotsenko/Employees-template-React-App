import { describe, expect, it } from "vitest";
import {
  parseCaptureLaunch,
  stripCaptureLaunchFromUrl,
} from "./captureLaunch";

describe("capture launch parsing", () => {
  it("combines shared title text and url without duplicating the link", () => {
    expect(
      parseCaptureLaunch(
        "?share-target=1&title=Release%20note&text=Read%20this&url=https%3A%2F%2Fexample.com",
      ),
    ).toEqual({
      kind: "share",
      prefill: "Release note — Read this — https://example.com",
    });

    expect(
      parseCaptureLaunch(
        "?share-target=1&text=Read%20https%3A%2F%2Fexample.com&url=https%3A%2F%2Fexample.com",
      )?.prefill,
    ).toBe("Read https://example.com");
  });

  it("opens an empty capture from an app shortcut", () => {
    expect(parseCaptureLaunch("?capture=1")).toEqual({
      kind: "capture",
      prefill: "",
    });
  });

  it("strips only one-time capture parameters from the launch url", () => {
    expect(
      stripCaptureLaunchFromUrl(
        "https://example.com/daydock/?share-target=1&title=Hello&keep=1#today",
      ),
    ).toBe("/daydock/?keep=1#today");
  });
});
