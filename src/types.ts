export enum TeamName {
  DEBORA = "Time Débora",
  MARILIA = "Time Marília"
}

export interface Consultant {
  extension: string;
  name: string;
  team: TeamName;
  isSupervisor?: boolean;
}

export interface ApiCallData {
  id: string;
  externalId: string;
  createdAt: string;
  origin: string;
  destiny: string;
  disposition: string;
  duration: number;
  type: string;
  calltype: string;
  originDisplayName: string | null;
  destinyDisplayName: string | null;
  sector?: string | null;
}

export interface CallRecord {
  id: string;
  extension: string;
  type: string; // "Ativa", "Receptiva" etc
  status: string; // "Atendida", "Não Atendida" etc
  duration: number;
  timestamp: string;
  displayName?: string;
  consultantName?: string;
  team?: TeamName;
}

export interface DashboardStats {
  totalCalls: number;
  successfulCalls: number;
  successRate: number;
  consultantStats: {
    name: string;
    team: TeamName;
    total: number;
    successful: number;
  }[];
  teamStats: {
    name: TeamName;
    total: number;
    successful: number;
  }[];
}
