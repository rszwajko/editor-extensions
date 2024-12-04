import { RuleSet, Violation } from "@editor-extensions/shared";

export const mergeRuleSets = (
  draft: RuleSet[],
  received: RuleSet[],
  filePaths: string[],
): RuleSet[] => {
  // remove old incidents in the files included in the partial analysis
  draft
    .flatMap((it) => [...Object.values(it.insights ?? {}), ...Object.values(it.violations ?? {})])
    .filter((v) => v.incidents?.some((incident) => filePaths.includes(incident.uri)))
    .forEach(
      (v) => (v.incidents = v.incidents.filter((incident) => !filePaths.includes(incident.uri))),
    );

  // filter out empty rule sets
  received
    .map((it): [string, [string, Violation][], [string, Violation][]] => [
      it.name ?? "",
      Object.entries(it.insights ?? {}),
      Object.entries(it.violations ?? {}),
    ])
    .map(([name, insights, violations]): [string, [string, Violation][], [string, Violation][]] => [
      name,
      insights.filter(([, violation]) => violation.incidents?.length),
      violations.filter(([, violation]) => violation.incidents?.length),
    ])
    .filter(([, insights, violations]) => insights.length || violations.length)
    // remaining insights/violations contain incidents
    .forEach(([name, insights, violations]) => {
      const current = draft.find((r) => r.name === name);
      if (!current) {
        return;
      }

      const merge = (target: { [key: string]: Violation }, violation: Violation) => {
        if (!target[name]) {
          target[name] = violation;
          return;
        }

        if (!target[name].incidents) {
          target[name].incidents = violation.incidents;
          return;
        }

        target[name].incidents.push(...violation.incidents);
      };

      insights.forEach(([name, violation]) => {
        if (!current.insights) {
          current.insights = { [name]: violation };
          return;
        }
        merge(current.insights, violation);
      });
      violations.forEach(([name, violation]) => {
        if (!current.violations) {
          current.violations = { [name]: violation };
          return;
        }

        merge(current.violations, violation);
      });
    });

  return draft;
};
