import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Manifest = {
  name: string;
  version: string;
  description: string;
  private: boolean;
  type: string;
  license: string;
  homepage: string;
  packageManager?: string;
  engines?: { node?: string };
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const pkg: Manifest = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));

const allDeps = () => ({ ...pkg.dependencies, ...pkg.devDependencies });

describe("what the manifest already promises", () => {
  it("stays private, so it can never be published to npm by accident", () => {
    expect(pkg.private).toBe(true);
  });

  it("is an ES module under AGPL-3", () => {
    expect(pkg.type).toBe("module");
    expect(pkg.license).toBe("AGPL-3");
  });

  it("carries a plain three-part version", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("describes itself in something a store would accept", () => {
    expect(pkg.description.length).toBeGreaterThan(0);
    expect(pkg.description.length).toBeLessThanOrEqual(132);
    expect(pkg.description).not.toMatch(/Web Extension$/);
  });

  it("keeps the scripts the workflow depends on", () => {
    const required = ["build", "compile", "lint", "test", "test:visual", "test:all"];
    expect(required.filter((script) => !pkg.scripts[script])).toEqual([]);
  });
});

describe("the exact-version convention", () => {
  it("pins every dependency exactly, with no range operator", () => {
    const ranged = Object.entries(allDeps()).filter(([, v]) => /^[\^~><*]|\s-\s|\|\|/.test(v));
    expect(ranged).toEqual([]);
  });

  it("gives every dependency a plain version, not a tag or a URL", () => {
    const odd = Object.entries(allDeps()).filter(([, v]) => !/^\d+\.\d+\.\d+/.test(v));
    expect(odd).toEqual([]);
  });
});

describe("the toolchain the project expects", () => {
  it("pins the package manager so corepack picks the right pnpm", () => {
    expect(pkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+/);
  });

  it("declares the Node floor its dependencies actually need", () => {
    expect(pkg.engines?.node).toMatch(/^>=\d+\.\d+\.\d+$/);
  });

  it("is satisfied by the Node running these tests", () => {
    const [, declared = "0"] = pkg.engines?.node?.match(/^>=(\d+)/) ?? [];
    const running = Number(process.versions.node.split(".")[0]);
    expect(running).toBeGreaterThanOrEqual(Number(declared));
  });

  it("does not claim a floor below what wxt and vitest require", () => {
    const [, declared = "0"] = pkg.engines?.node?.match(/^>=(\d+)/) ?? [];
    expect(Number(declared)).toBeGreaterThanOrEqual(22);
  });
});
