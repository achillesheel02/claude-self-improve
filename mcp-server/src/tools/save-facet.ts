import { randomUUID } from "crypto";
import { insertFacet } from "../db.js";
import {
  validateFacet,
  parseFacetJson,
  type Facet,
} from "../validators/facet-validator.js";

export interface SaveFacetInput {
  facet_json: string;
  session_id?: string;
  source?: string;
}

export interface SaveFacetResult {
  success: boolean;
  facet_id: string;
  coercions: number;
  errors: string[];
}

export function saveFacet(input: SaveFacetInput): SaveFacetResult {
  // Parse JSON (handles markdown fences)
  let facet: Facet;
  try {
    facet = parseFacetJson(input.facet_json);
  } catch (e) {
    return {
      success: false,
      facet_id: "",
      coercions: 0,
      errors: [
        `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      ],
    };
  }

  // Set metadata
  const facetId = input.session_id || facet.session_id || randomUUID();
  facet.session_id = facetId;
  facet.source = input.source || facet.source || "mcp-inline";
  facet.timestamp = facet.timestamp || new Date().toISOString();

  // Validate and coerce
  const { facet: validated, coercions, errors } = validateFacet(facet);

  // Write to SQLite
  insertFacet(validated as Record<string, any>);

  return {
    success: true,
    facet_id: facetId,
    coercions,
    errors,
  };
}
