export interface CptCode {
  code: string;
  description: string;
  category: string;
}

export const CPT_CODES: CptCode[] = [
  // Evaluations
  { code: "97165", description: "OT Evaluation — Low Complexity",      category: "Evaluation" },
  { code: "97166", description: "OT Evaluation — Moderate Complexity", category: "Evaluation" },
  { code: "97167", description: "OT Evaluation — High Complexity",     category: "Evaluation" },
  { code: "97168", description: "OT Re-evaluation",                    category: "Evaluation" },
  // Therapeutic Procedures
  { code: "97110", description: "Therapeutic Exercises",                              category: "Therapeutic" },
  { code: "97112", description: "Neuromuscular Reeducation of Movement",              category: "Therapeutic" },
  { code: "97116", description: "Gait Training",                                      category: "Therapeutic" },
  { code: "97129", description: "Therapeutic Interventions for Cognitive Function",   category: "Therapeutic" },
  { code: "97130", description: "Therapeutic Interventions for Cognitive Function — each additional 15 min", category: "Therapeutic" },
  { code: "97150", description: "Therapeutic Procedure, Group (2 or more patients)", category: "Therapeutic" },
  { code: "97530", description: "Therapeutic Activities",              category: "Therapeutic" },
  { code: "97533", description: "Sensory Integration Techniques",      category: "Therapeutic" },
  { code: "97535", description: "Self-Care / Home Management Training",category: "Therapeutic" },
  { code: "97537", description: "Community / Work Reintegration Training", category: "Therapeutic" },
  { code: "97542", description: "Wheelchair Management Training",      category: "Therapeutic" },
  { code: "97545", description: "Work Conditioning / Hardening — initial 2 hours",   category: "Therapeutic" },
  { code: "97546", description: "Work Conditioning / Hardening — each additional hour", category: "Therapeutic" },
  // Orthotic / Prosthetic
  { code: "97760", description: "Orthotic Management and Training — initial encounter", category: "Orthotic" },
  { code: "97761", description: "Prosthetic Training — initial encounter",             category: "Orthotic" },
  { code: "97762", description: "Checkout for Orthotic / Prosthetic Use",             category: "Orthotic" },
  // Assessments
  { code: "96125", description: "Standardized Cognitive Performance Testing",  category: "Assessment" },
  { code: "96127", description: "Brief Emotional / Behavioral Assessment",     category: "Assessment" },
  { code: "97750", description: "Physical Performance Test or Measurement",    category: "Assessment" },
  // Physical Agent Modalities
  { code: "97010", description: "Hot / Cold Packs",                    category: "Modalities" },
  { code: "97012", description: "Mechanical Traction",                 category: "Modalities" },
  { code: "97014", description: "Electrical Stimulation (Unattended)", category: "Modalities" },
  { code: "97016", description: "Vasopneumatic Devices",               category: "Modalities" },
  { code: "97018", description: "Paraffin Bath",                       category: "Modalities" },
  { code: "97022", description: "Whirlpool",                           category: "Modalities" },
  { code: "97024", description: "Diathermy",                           category: "Modalities" },
  { code: "97026", description: "Infrared Therapy",                    category: "Modalities" },
  { code: "97028", description: "Ultraviolet Therapy",                 category: "Modalities" },
  { code: "97032", description: "Electrical Stimulation (Attended)",   category: "Modalities" },
  { code: "97033", description: "Iontophoresis",                       category: "Modalities" },
  { code: "97034", description: "Contrast Baths",                      category: "Modalities" },
  { code: "97035", description: "Ultrasound",                          category: "Modalities" },
  { code: "97036", description: "Hubbard Tank",                        category: "Modalities" },
  { code: "97039", description: "Unlisted Therapeutic Procedure",      category: "Modalities" },
];
