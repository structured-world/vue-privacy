import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

/**
 * Rewrites the relative module specifiers in emitted declaration files to the form ESM
 * resolution requires (`node16`/`nodenext`): `./types` becomes `./types.js`, a directory such as
 * `..` becomes `../index.js`, and `./Banner.vue` becomes `./Banner.vue.js`. The package is
 * `"type": "module"`, so its `.d.ts` files are ES modules, and the sources' extensionless
 * specifiers (and the ones the compiler synthesizes for inferred types) resolve only under
 * `bundler` resolution.
 *
 * Each specifier is resolved against the declaration files actually emitted; one that names no
 * emitted declaration fails the build instead of shipping a type that degrades to `any`.
 *
 * @param emitted Every emitted file, absolute path to content (vite-plugin-dts `afterBuild`).
 */
export function rewriteDeclarationSpecifiers(emitted: ReadonlyMap<string, string>): void {
  const declarations = new Set([...emitted.keys()].filter((path) => path.endsWith(".d.ts")));
  for (const path of declarations) {
    const content = emitted.get(path) ?? "";
    const rewritten = rewriteFile(path, content, declarations);
    if (rewritten !== content) writeFileSync(path, rewritten);
  }
}

function rewriteFile(path: string, content: string, declarations: ReadonlySet<string>): string {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
  const literals: ts.StringLiteral[] = [];
  collectSpecifiers(source, literals);

  let result = content;
  // From the end, so earlier offsets stay valid while later literals are replaced.
  for (const literal of literals.sort((a, b) => b.end - a.end)) {
    if (!isRelative(literal.text)) continue;
    const specifier = resolveSpecifier(path, literal.text, declarations);
    // Inside the quotes, keeping the emitter's quote style.
    result =
      result.slice(0, literal.getStart(source) + 1) + specifier + result.slice(literal.end - 1);
  }
  return result;
}

/** Specifiers of `import`/`export ... from` and of `import("...")` types, the forms TS emits. */
function collectSpecifiers(node: ts.Node, out: ts.StringLiteral[]): void {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    out.push(node.moduleSpecifier);
  } else if (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteral(node.argument.literal)
  ) {
    out.push(node.argument.literal);
  }
  ts.forEachChild(node, (child) => collectSpecifiers(child, out));
}

function isRelative(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

function resolveSpecifier(
  from: string,
  specifier: string,
  declarations: ReadonlySet<string>
): string {
  const bare = specifier.replace(/\/+$/, "");
  const target = resolve(dirname(from), bare);
  if (bare.endsWith(".js") && declarations.has(`${target.slice(0, -3)}.d.ts`)) return bare;
  if (declarations.has(`${target}.d.ts`)) return `${bare}.js`;
  if (declarations.has(resolve(target, "index.d.ts"))) return `${bare}/index.js`;
  throw new Error(`${from}: "${specifier}" names no emitted declaration file`);
}
