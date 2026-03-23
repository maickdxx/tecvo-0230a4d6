export interface DefaultCatalogService {
  name: string;
  unit_price: number;
  description: string;
  group: string;
  service_type: string;
}

const DEFAULT_CATALOG_SERVICES: DefaultCatalogService[] = [
  // Instalação
  { name: "Instalação de Ar Condicionado 9.000 BTUs", unit_price: 850, description: "", group: "Instalação", service_type: "instalacao" },
  { name: "Instalação de Ar Condicionado 12.000 BTUs", unit_price: 850, description: "", group: "Instalação", service_type: "instalacao" },
  { name: "Instalação de Ar Condicionado 18.000 BTUs", unit_price: 900, description: "", group: "Instalação", service_type: "instalacao" },
  { name: "Instalação Elétrica para Ar Condicionado", unit_price: 350, description: "", group: "Instalação", service_type: "instalacao" },

  // Limpeza
  { name: "Limpeza de Ar Condicionado 9.000 BTUs", unit_price: 250, description: "", group: "Limpeza", service_type: "limpeza" },
  { name: "Limpeza de Ar Condicionado 12.000 BTUs", unit_price: 250, description: "", group: "Limpeza", service_type: "limpeza" },
  { name: "Limpeza de Ar Condicionado 18.000 BTUs", unit_price: 250, description: "", group: "Limpeza", service_type: "limpeza" },
  { name: "Limpeza de Ar Condicionado Piso Teto 36.000 BTUs", unit_price: 600, description: "", group: "Limpeza", service_type: "limpeza" },
  { name: "Limpeza de Ar Condicionado Cassete 60.000 BTUs", unit_price: 600, description: "", group: "Limpeza", service_type: "limpeza" },

  // Manutenção
  { name: "Recarga de Gás Refrigerante", unit_price: 600, description: "", group: "Manutenção", service_type: "manutencao" },
  { name: "Troca de Capacitor", unit_price: 290, description: "", group: "Manutenção", service_type: "manutencao" },

  // Outros
  { name: "Visita Técnica", unit_price: 100, description: "", group: "Outros", service_type: "outros" },
  { name: "Desinstalação de Ar Condicionado Split 9.000 BTUs", unit_price: 250, description: "", group: "Outros", service_type: "outros" },
  { name: "Desinstalação de Ar Condicionado Split 12.000 BTUs", unit_price: 250, description: "", group: "Outros", service_type: "outros" },
];

export function getDefaultCatalogServices(): DefaultCatalogService[] {
  return DEFAULT_CATALOG_SERVICES;
}
