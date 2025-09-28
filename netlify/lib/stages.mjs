// /netlify/lib/stages.mjs
// Orden actualizado: Revisión de contratos va ANTES que Due Diligence.
export function getStageOrder() {
  return [
    "Primera reunión",
    "NDA",
    "Entrega de información",
    "Generación de propuesta",
    "Presentación de propuesta",
    "Ajustes técnicos",
    "LOI",
    "Revisión de contratos",
    "Due Diligence",            // <= va después de "Revisión de contratos"
    "Cronograma de inversión",
    "Firma"
  ];
}
