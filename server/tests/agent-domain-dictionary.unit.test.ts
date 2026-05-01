import {
  extractJobConcepts,
  sharedJobConceptScore,
} from "../src/modules/agent/agent-domain-dictionary";

describe("agent domain dictionary", () => {
  it("normalizes mixed Chinese and English job concepts", () => {
    expect(extractJobConcepts("厨房 tap 漏水")).toEqual(["leak", "tap", "kitchen"]);
  });

  it("scores shared concepts from explicit extractor hints", () => {
    expect(
      sharedJobConceptScore("", "Kitchen tap repair", ["漏水", "水龙头"]),
    ).toBeGreaterThan(0);
  });
});
