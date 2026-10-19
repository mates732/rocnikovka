/**
 * Single source of truth for the scientific types and validation rules.
 *
 * The domain types and the validation schema are pure TypeScript with no
 * Node/DB dependencies, so they are imported from the existing backend rather
 * than copied. A second copy could silently diverge from the locked scientific
 * rules, which is the one thing this migration must never do.
 */
export type * from "../../server/src/types.js";
export * from "../../server/src/validation/schema.js";
