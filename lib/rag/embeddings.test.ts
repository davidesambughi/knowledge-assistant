import { describe, expect, it } from "vitest";
import { batchTexts } from "./embeddings";

describe("batchTexts", () => {
  it("splits an array into exact-multiple batches", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(batchTexts(items, 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it("keeps a partial last batch", () => {
    const items = [1, 2, 3, 4, 5];
    expect(batchTexts(items, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single batch when the array is shorter than batchSize", () => {
    const items = ["a", "b"];
    expect(batchTexts(items, 100)).toEqual([["a", "b"]]);
  });

  it("returns an empty array for empty input", () => {
    expect(batchTexts([], 10)).toEqual([]);
  });
});
