import { RuleSet, Violation } from "@editor-extensions/shared";
import { produce } from "immer";

export const mergeRuleSets = (
  current: RuleSet[],
  received: RuleSet[],
  filePaths: string[],
): RuleSet[] => {
  return produce(current, (draft: RuleSet[]) => {
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
      .map(
        ([name, insights, violations]): [string, [string, Violation][], [string, Violation][]] => [
          name,
          insights.filter(([, violation]) => violation.incidents?.length),
          violations.filter(([, violation]) => violation.incidents?.length),
        ],
      )
      .filter(([, insights, violations]) => insights.length || violations.length)
      .forEach(([name, insights, violations]) => {
        const current = draft.find((r) => r.name === name);
        if (!current) {
          return;
        }

        insights.forEach(([name, violation]) => {
          if (!current.insights) {
            current.insights = { [name]: violation };
            return;
          }

          if (!current.insights[name]) {
            current.insights[name] = violation;
            return;
          }

          if (!current.insights[name].incidents) {
            current.insights[name].incidents = violation.incidents;
            return;
          }

          current.insights[name].incidents.push(...violation.incidents);
        });
        violations.forEach(([name, violation]) => {
          if (!current.violations) {
            current.violations = { [name]: violation };
            return;
          }

          if (!current.violations[name]) {
            current.violations[name] = violation;
            return;
          }

          if (!current.violations[name].incidents) {
            current.violations[name].incidents = violation.incidents;
            return;
          }

          current.violations[name].incidents.push(...violation.incidents);
        });
      });

    return draft;
  });
};
