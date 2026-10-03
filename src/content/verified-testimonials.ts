/** Publish only real, consented customer quotes with a recorded verification date. */
export const VERIFIED_TESTIMONIALS: readonly {
  quote: string; name: string; role: string; verifiedAt: string; consent: true;
}[] = [];
