import * as assert from "assert";
import { DiagnosticSeverity } from "vscode";
import * as path from "path";
import { processIncidents, readYamlFile } from "../data/analyzerResults";
import { RuleSet } from "@shared/types";

suite("Extension Test Suite", () => {
  test("processIncidents should populate diagnostics correctly", () => {
    const filePath = path.resolve(__dirname, "./testData/output-data.yaml");
    const ruleSets: RuleSet[] | undefined = readYamlFile(filePath);
    assert.ok(ruleSets, "RuleSets should be loaded from YAML file");
    const results = processIncidents(ruleSets!);
    assert.ok(
      results.every(([uri]) => uri.fsPath === "/opt/input/source/src/main/webapp/WEB-INF/web.xml"),
      "web.xml diagnostics should exist",
    );
    assert.strictEqual(results?.length, 4, "web.xml should have 4 diagnostics");
    assert.ok(
      results
        .flatMap(([, diagnostics]) => diagnostics)
        .every((diagnostic) => diagnostic?.severity === DiagnosticSeverity.Error),
      "Diagnostic severity for web.xml should be Error",
    );
  });
});
