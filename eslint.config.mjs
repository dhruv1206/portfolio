// ESLint 9 flat config. eslint-config-next@16 ships a flat-config
// array at its `/core-web-vitals` subpath, so we import it directly
// (no FlatCompat shim required).

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
    ...nextCoreWebVitals,
    {
        ignores: [
            ".next/**",
            "node_modules/**",
            "out/**",
            ".lighthouseci/**",
            "scripts/**",
        ],
    },
];

export default config;
