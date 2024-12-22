import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "aws",
    exclude: [
      "node_modules/@jimpick/fireproof-core/tests/react/**",
      "node_modules/@jimpick/fireproof-core/tests/fireproof/config.test.ts",
    ],
    include: [
      "src/aws/*test.?(c|m)[jt]s?(x)",
      // "node_modules/@jimpick/fireproof-core/tests/**/*test.?(c|m)[jt]s?(x)",
      "src/connector.test.ts",
    ],
    globals: true,
    setupFiles: "./setup.aws.ts",
    testTimeout: 25000,
  },
});
