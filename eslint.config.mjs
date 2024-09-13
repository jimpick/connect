import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  //   ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    ignores: [
      "babel.config.cjs",
      "jest.config.js",
      "**/dist/",
      "**/pubdir/",
      "**/node_modules/",
      "**/scripts/",
      "**/examples/",
      "smoke/react/",
      "tests/connect-netlify/app/index.global.js",
      "tests/connect-netlify/app/fireproof.iife.js",
      "tests/connect-netlify/app/connect-netlify.iife.js",
    ],
  },
  {
    rules: {
      "no-console": ["warn"],
    },
  }
);
