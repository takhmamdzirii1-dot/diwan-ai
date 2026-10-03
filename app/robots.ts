import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/src/content/site';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/studio/'] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml` };
}
