import { RuleSet } from "@shared/types";
import { processIncidents } from "./analyzerResults";
import { ExtensionState } from "src/extensionState";
import { loadStaticResults } from "./loadStaticResults";

export default (state: ExtensionState) => ({
  "konveyor.loadRuleSets": (ruleSets: RuleSet[]): void => {
    state.extensionContext.workspaceState.update("storedRuleSets", ruleSets);
    state.diagnosticCollection.set(processIncidents(ruleSets));
    state.sidebarProvider?.webview?.postMessage({
      type: "loadStoredAnalysis",
      data: ruleSets,
    });
  },
  "konveyor.cleanRuleSets": () => {
    state.extensionContext.workspaceState.update("storedRuleSets", undefined);
    state.diagnosticCollection.clear();
    state.sidebarProvider?.webview?.postMessage({
      type: "loadStoredAnalysis",
      data: undefined,
    });
  },
  "konveyor.loadStaticResults": loadStaticResults,
});
