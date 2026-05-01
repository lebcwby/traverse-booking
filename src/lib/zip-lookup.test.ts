import { describe, it, expect } from "vitest";
import { nearestZip } from "./zip-lookup";

describe("nearestZip", () => {
  it("returns a Portland OR zip for downtown Portland coords", () => {
    const zip = nearestZip(45.5152, -122.6784);
    expect(zip).toMatch(/^972/);
  });

  it("returns a Manhattan zip for Times Square coords", () => {
    const zip = nearestZip(40.758, -73.9855);
    expect(zip).toMatch(/^100/);
  });

  it("returns a San Francisco zip for SF coords", () => {
    const zip = nearestZip(37.7749, -122.4194);
    expect(zip).toMatch(/^941/);
  });

  it("returns a Miami zip for Miami coords", () => {
    const zip = nearestZip(25.7617, -80.1918);
    expect(zip).toMatch(/^331/);
  });

  it("returns null for invalid input", () => {
    expect(nearestZip(NaN, -122)).toBeNull();
    expect(nearestZip(45, NaN)).toBeNull();
  });

  it("returns a zip for rural Wyoming coords", () => {
    const zip = nearestZip(43.0, -107.5);
    expect(zip).toMatch(/^\d{5}$/);
  });
});
