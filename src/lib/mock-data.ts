export const MOCK_CONTRACTS = [
  { id: "c-001", code: "PRJ-2025-001", name: "Edifício Aurora — Orçamento Executivo", client: "Construtora Aurora" },
  { id: "c-002", code: "PRJ-2025-014", name: "Hospital Vital — Revisão de Custos", client: "Vital Saúde" },
  { id: "c-003", code: "PRJ-2025-022", name: "Refinaria Norte — Modelagem 5D", client: "PetroNorte" },
  { id: "c-004", code: "PRJ-2025-031", name: "Shopping Vista — Acompanhamento", client: "Vista Empreendimentos" },
  { id: "c-005", code: "INT-2025-002", name: "Atividades Internas / Administrativo", client: "Interno" },
];

export const ACTIVITIES = [
  "Orçamento",
  "Modelagem BIM",
  "Reunião com cliente",
  "Análise de propostas",
  "Levantamento de quantitativos",
  "Revisão técnica",
  "Relatório / Documentação",
  "Administrativo",
  "Outros",
];

export const ACTIVITY_REQUIRING_NOTES = "Outros";

export type TimeEntry = {
  id: string;
  contractId: string;
  contractName: string;
  activity: string;
  notes?: string;
  start: number; // epoch ms
  end: number | null;
  edited?: boolean;
};
