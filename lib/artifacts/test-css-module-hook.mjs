import { registerHooks } from 'node:module';

// Node's focused TSX tests render markup without a bundler. CSS modules only
// provide class names there; the browser checks their computed styles.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.module.css')) return {
      format: 'module', source: 'export default new Proxy({}, { get: (_, name) => String(name) });', shortCircuit: true,
    };
    return nextLoad(url, context);
  },
});
