/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Reverted static export — the new /api/practice/* routes hold a Groq API key server-side,
  // which needs an actual server at runtime (static export has none and can't do this safely).
  // By default a production build ships minified bundles with no source maps, so DevTools'
  // Sources panel only shows the bundled/minified code, not the original .tsx files — this
  // turns real source maps back on for the production build too (dev mode already has them).
  productionBrowserSourceMaps: true,
  // pdf-parse (used by /api/practice/resume for resume text extraction) pulls in pdfjs-dist,
  // which breaks when webpack bundles it into the server graph — its ESM interop shims don't
  // survive that bundling and throw "Object.defineProperty called on non-object" at import
  // time. Marking it (and its native canvas dependency) external makes Node require() it
  // directly at runtime instead, which works correctly.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  },
};
module.exports = nextConfig;
