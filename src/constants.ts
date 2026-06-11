import { Consultant, TeamName } from './types.ts';

export const CONSULTANT_MAPPING: Record<string, Consultant> = {
  // Time Débora (Supervisora: 6005)
  "6028": { extension: "6028", name: "Charlene", team: TeamName.DEBORA },
  "6002": { extension: "6002", name: "Erick", team: TeamName.DEBORA },
  "6007": { extension: "6007", name: "Everton", team: TeamName.DEBORA },
  "6006": { extension: "6006", name: "Rodrigo", team: TeamName.DEBORA },
  "6045": { extension: "6045", name: "Marcos", team: TeamName.DEBORA },
  "6046": { extension: "6046", name: "Karina", team: TeamName.DEBORA },
  "6029": { extension: "6029", name: "Rute", team: TeamName.DEBORA },
  "6011": { extension: "6011", name: "Auryane", team: TeamName.DEBORA },

  // Time Marília (Supervisora: 6038)
  "6036": { extension: "6036", name: "Aila", team: TeamName.MARILIA },
  "6026": { extension: "6026", name: "Kelvyn", team: TeamName.MARILIA },
  "6017": { extension: "6017", name: "Felipe", team: TeamName.MARILIA },
  "6037": { extension: "6037", name: "Roney", team: TeamName.MARILIA },
  "6022": { extension: "6022", name: "Gabriela", team: TeamName.MARILIA },
  "6039": { extension: "6039", name: "Hillary", team: TeamName.MARILIA },
  "6030": { extension: "6030", name: "Kephini", team: TeamName.MARILIA },
  "6040": { extension: "6040", name: "Anna", team: TeamName.MARILIA },
};

export const ALLOWED_EXTENSIONS = Object.keys(CONSULTANT_MAPPING);
