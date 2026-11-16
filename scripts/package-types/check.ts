// Type-checks the packed package the way a consumer installs it, under every module resolution a
// consumer may use. Run after `yarn build`: `yarn test:types`.
//
// The consumer is a fresh `"type": "module"` project holding the extracted `npm pack` tarball;
// `vue`, `vue-router` and `vitepress` (imported by the entry points' declarations) are linked from
// this repository. `skipLibCheck` is off, so an error inside the published declarations fails the
// check instead of quietly degrading exports to `any`.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

const repoRoot = resolve(import.meta.dirname, "../..");
const fixtures = import.meta.dirname;
const FIXTURES = ["valid.mts", "invalid.mts"];
const PACKAGE_DIR = "node_modules/@structured-world/vue-privacy";
const LINKED_DEPENDENCIES = ["vue", "vue-router", "vitepress"];
const EXPECT_MARKER = /\/\/ @expect TS(\d+)\s*$/;

interface Mode {
  name: string;
  options: ts.CompilerOptions;
}

const MODES: Mode[] = [
  {
    name: "node16",
    options: { module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16 },
  },
  {
    name: "nodenext",
    options: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext },
  },
  {
    name: "bundler",
    options: { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
  },
];

const BASE_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  strict: true,
  noEmit: true,
  skipLibCheck: false,
};

function packTarball(destination: string): string {
  const output = execFileSync("npm", ["pack", "--json", "--pack-destination", destination], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const parsed: unknown = JSON.parse(output);
  const first: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
  if (
    typeof first !== "object" ||
    first === null ||
    !("filename" in first) ||
    typeof first.filename !== "string"
  ) {
    throw new Error(`Unexpected \`npm pack --json\` output: ${output}`);
  }
  return join(destination, first.filename);
}

function createConsumer(work: string, tarball: string): string {
  const consumer = join(work, "consumer");
  const installed = join(consumer, PACKAGE_DIR);
  mkdirSync(dirname(installed), { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", work]);
  renameSync(join(work, "package"), installed);
  for (const dependency of LINKED_DEPENDENCIES) {
    symlinkSync(
      join(repoRoot, "node_modules", dependency),
      join(consumer, "node_modules", dependency),
      "dir"
    );
  }
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" })
  );
  for (const fixture of FIXTURES) {
    copyFileSync(join(fixtures, fixture), join(consumer, fixture));
  }
  return consumer;
}

/** `file:line:TScode` of every line marked `// @expect TScode` in the fixtures. */
function expectedDiagnostics(): Set<string> {
  const expected = new Set<string>();
  for (const fixture of FIXTURES) {
    readFileSync(join(fixtures, fixture), "utf8")
      .split("\n")
      .forEach((text, index) => {
        const match = EXPECT_MARKER.exec(text);
        if (match) expected.add(`${fixture}:${index + 1}:TS${match[1]}`);
      });
  }
  return expected;
}

function checkMode(consumer: string, mode: Mode, expected: Set<string>): boolean {
  const program = ts.createProgram(
    FIXTURES.map((fixture) => join(consumer, fixture)),
    { ...BASE_OPTIONS, ...mode.options }
  );
  const actual = new Map<string, string>();
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    let location = "(global)";
    if (diagnostic.file && diagnostic.start !== undefined) {
      const file = relative(consumer, diagnostic.file.fileName);
      // Errors inside other packages' declarations (vitepress ships some) are theirs, not ours.
      if (!FIXTURES.includes(file) && !file.startsWith(`${PACKAGE_DIR}/`)) continue;
      const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      location = `${file}:${line + 1}`;
    }
    actual.set(`${location}:TS${diagnostic.code}`, message);
  }

  const unexpected = [...actual].filter(([key]) => !expected.has(key));
  const missing = [...expected].filter((key) => !actual.has(key));
  for (const [key, message] of unexpected)
    console.error(`${mode.name}: unexpected ${key} ${message}`);
  for (const key of missing) console.error(`${mode.name}: expected error not reported: ${key}`);
  const passed = unexpected.length === 0 && missing.length === 0;
  if (passed) console.log(`${mode.name}: ok, ${expected.size} expected errors and no others`);
  return passed;
}

const work = realpathSync(mkdtempSync(join(tmpdir(), "vue-privacy-types-")));
try {
  const consumer = createConsumer(work, packTarball(work));
  const expected = expectedDiagnostics();
  const results = MODES.map((mode) => checkMode(consumer, mode, expected));
  if (results.includes(false)) process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
