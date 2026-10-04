// Official Next.js client instrumentation entry. The SDK itself loads only
// after optional marketing consent, never during SSR or before permission.
import { installAnalyticsNavigation } from './src/lib/product-analytics';
installAnalyticsNavigation();
