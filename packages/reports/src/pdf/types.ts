/**
 * PDF Generation Options and Output Contracts
 */

export interface PdfRenderOptions {
  /** Paper format (default: "A4") */
  format?: "A4" | "Letter" | "Legal";
  /** Whether to print background graphics (default: true) */
  printBackground?: boolean;
  /** Landscape orientation (default: false) */
  landscape?: boolean;
  /** Margins around content (default: 24mm top/bottom, 15mm left/right) */
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  /** Whether to display running header and footer with page numbers (default: true) */
  displayHeaderFooter?: boolean;
  /** Custom header template HTML override */
  headerTemplate?: string;
  /** Custom footer template HTML override */
  footerTemplate?: string;
}

export interface PdfUploadOptions extends PdfRenderOptions {
  /** Whether to persist the generated PDF to Vercel Blob (default: true) */
  uploadToBlob?: boolean;
  /** Lifecycle expiry in days (default: 30 days per product blueprint) */
  expiresInDays?: number;
  /** Custom blob storage path (default: scans/{scanId}/reports/{presentationType}-{reportId}.pdf) */
  blobPathOverride?: string;
}

export interface PdfGenerationResult {
  /** Generated binary PDF buffer */
  readonly pdfBuffer: Buffer;
  /** Byte size of the generated PDF */
  readonly sizeBytes: number;
  /** MIME content type ("application/pdf") */
  readonly contentType: string;
  /** Vercel Blob storage key/pathname (if uploaded) */
  readonly blobKey?: string;
  /** Public or signed Blob URL (if uploaded) */
  readonly blobUrl?: string;
  /** ISO timestamp when the raw artifact will expire (30 days default) */
  readonly expiresAt?: string;
}
