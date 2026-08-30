/**
 * Image provider abstraction — VANTRA Studio
 *
 * Capabilities model:
 *  - "platform"        → VANTRA pays (mock/dev only right now)
 *  - "free"            → genuinely free public endpoint (Pollinations anonymous/referrer tier)
 *  - "user_associated" → costs land on the end user's own provider account (Puter.js User-Pays)
 *  - "byop"            → user brings their own provider key/token (future: Pollinations Seed tier)
 *
 * Never place a privileged server secret in any client-callable path.
 */

export type ProviderPricing = 'platform' | 'free' | 'user_associated' | 'byop';

export interface ProviderMeta {
  id: string;
  name: string;
  type: 'image';
  pricing: ProviderPricing;
  requiresApiKey: boolean;
  requiresAuthorization: boolean;
  /** Runs in the browser (Puter.js) instead of via the VANTRA API route. */
  clientSide: boolean;
  models: { id: string; name: string }[];
  /** Short user-facing note shown in the provider picker. */
  note: string;
}

export interface ImageGenerateParams {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  /** Authenticated VANTRA user id (server-validated). Empty for guests. */
  userId?: string;
  /** Optional reference image URL for img2img-capable providers. */
  imageUrl?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  provider: string;
  model?: string;
  imageUrl?: string;
  /** base64 data URL when the provider returns raw bytes. */
  imageData?: string;
  requestId?: string;
  error?: string;
  /** true when no VANTRA credit should be deducted. */
  userFunded?: boolean;
}

export interface ImageProvider {
  meta: ProviderMeta;
  generateImage(params: ImageGenerateParams): Promise<ImageGenerationResult>;
}
