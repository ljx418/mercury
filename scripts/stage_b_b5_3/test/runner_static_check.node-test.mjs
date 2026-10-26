// The runner's static gate: no undefined identifier may reach a real run.
//
// A missing binding in the runner is not a cosmetic defect: it aborts a
// source attempt before the product starts and it consumes the one visible
// budget. The TypeScript compiler that the repository already ships parses
// the runner and reports every name it cannot resolve (TS2304).
//
// The check is OFFLINE: it reads the sources, it starts nothing.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const typescriptPath = path.join(
  repoRoot,
  "apps/chrome-extension/node_modules/typescript/lib/typescript.js",
);

const RUNNER_SOURCES = [
  "scripts/stage_b_b5_3/run_one_bvid.mjs",
  "scripts/stage_b_b5_3/sequencer.mjs",
  "scripts/stage_b_b5_3/production_preflight.mjs",
  "scripts/stage_b_b5_3/lib/contracts.mjs",
  "scripts/stage_b_b5_3/lib/preflight.mjs",
  "scripts/stage_b_b5_3/lib/registry.mjs",
  "scripts/stage_b_b5_3/lib/aggregate.mjs",
  "scripts/stage_b_b5_3/lib/owned_session.mjs",
];

test("the runner sources resolve every identifier they use", async () => {
  assert.ok(fs.existsSync(typescriptPath), "the repository's TypeScript compiler is available");
  const ts = await import(`file://${typescriptPath.replaceAll("\\", "/")}`);
  const files = RUNNER_SOURCES.map((relative) => path.join(repoRoot, relative));
  const program = ts.createProgram(files, {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
    skipLibCheck: true,
  });
  const undefinedNames = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.code === 2304)
    .map((diagnostic) => {
      const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return `${path.basename(diagnostic.file.fileName)}:${line + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    });
  assert.deepEqual(undefinedNames, [], "the runner must not use an undefined identifier");
});

/**
 * A module-level function may not read a block-scoped declaration.
 *
 * This is the exact defect that aborted a real batch: the variable was
 * declared inside the `try` block and the module-level Runtime launcher
 * could not see it. The TypeScript "cannot find name" check does NOT report
 * it for JavaScript, so the scope is checked here.
 */
test("no module-level function reads a block-scoped declaration", async () => {
  const ts = await import(`file://${typescriptPath.replaceAll("\\", "/")}`);
  const offenders = [];
  for (const relative of RUNNER_SOURCES) {
    const file = path.join(repoRoot, relative);
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.JS,
    );
    // The block-scoped declarations, per enclosing block.
    const blockScoped = new Map(); // node id -> names
    const visit = (node) => {
      if (ts.isBlock(node) || ts.isSourceFile(node)) {
        const names = new Set();
        for (const statement of node.statements) {
          if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
              if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
            }
          }
        }
        blockScoped.set(node, names);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    // The module scope: the top level declarations.
    const moduleScope = new Set();
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) moduleScope.add(declaration.name.text);
        }
      } else if (ts.isFunctionDeclaration(statement) && statement.name) {
        moduleScope.add(statement.name.text);
      } else if (ts.isClassDeclaration(statement) && statement.name) {
        moduleScope.add(statement.name.text);
      } else if (ts.isImportDeclaration(statement)) {
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) moduleScope.add(element.name.text);
        } else if (statement.importClause?.name) {
          moduleScope.add(statement.importClause.name.text);
        }
      }
    }
    // Every module-level function: the names it reads that exist ONLY in a
    // nested block.
    for (const statement of source.statements) {
      if (!ts.isFunctionDeclaration(statement) || !statement.name) continue;
      const functionScope = new Set();
      const bindNames = (name) => {
        if (ts.isIdentifier(name)) { functionScope.add(name.text); return; }
        if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
          for (const element of name.elements) {
            if (ts.isBindingElement(element)) bindNames(element.name);
          }
        }
      };
      for (const parameter of statement.parameters) bindNames(parameter.name);
      // Every declaration inside the function body, at any depth, is local
      // to the function. The PARAMETERS of a nested function are local to
      // that nested function and therefore to the outer one as well.
      const collectLocals = (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          functionScope.add(node.name.text);
        }
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
          for (const parameter of node.parameters ?? []) {
            const name = parameter.name;
            if (ts.isIdentifier(name)) functionScope.add(name.text);
            else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
              for (const element of name.elements) {
                if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                  functionScope.add(element.name.text);
                }
              }
            }
          }
        }
        ts.forEachChild(node, collectLocals);
      };
      collectLocals(statement.body);
      const read = new Set();
      const collect = (node) => {
        if (ts.isIdentifier(node)) {
          // A property name is not a variable read.
          const parent = node.parent;
          const isPropertyName = parent
            && (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent))
            && parent.name === node;
          if (!isPropertyName) read.add(node.text);
        }
        ts.forEachChild(node, collect);
      };
      collect(statement.body);
      for (const [block, names] of blockScoped.entries()) {
        if (block === source) continue;
        for (const name of names) {
          if (read.has(name) && !moduleScope.has(name) && !functionScope.has(name)) {
            offenders.push(`${relative}: ${statement.name.text}() reads block-scoped "${name}"`);
          }
        }
      }
    }
  }
  assert.deepEqual(offenders, [], "a module-level function may not read a block-scoped declaration");
});

test("the real persistent Chrome context is awaited before use", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs"),
    "utf8",
  );
  assert.match(
    source,
    /context\s*=\s*await\s+externalMilestone\("before_chrome"/,
    "launchPersistentContext must resolve before context.pages()/close() are used",
  );
});

test("the runner reads the Runtime's product-evidence diagnostic path", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs"),
    "utf8",
  );
  assert.match(
    source,
    /path\.join\(mediaTaskRoot,\s*"product-evidence",\s*"diagnostics"/,
    "failed synthesis must retain the Runtime-owned request count diagnostic",
  );
});
