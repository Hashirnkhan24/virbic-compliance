/**
 * @vibe/reports — Report Generation Engine
 *
 * Implements Stage 12 & Stage 13 of the product blueprint.
 * Converts completed scan outputs and rules evaluation into validated structured
 * reports, renders presentation-specific HTML (SaaS Founder vs Agency Handover),
 * and generates downloadable Chromium PDFs stored in Vercel Blob.
 */

export const MODULE_NAME = "@vibe/reports";

export * from "./types";
export * from "./builder";
export * from "./generator";
export * from "./renderer/html-renderer";
export * from "./pdf/types";
export * from "./pdf/header-footer";
export * from "./pdf/pdf-generator";
