import { IncidentTypeItem } from "./issueModel";

export const fixGroupOfIncidents = async (item: IncidentTypeItem) => {
  if (item) {
    item.fix();
  }
};
