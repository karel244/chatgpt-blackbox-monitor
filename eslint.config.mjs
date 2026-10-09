import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        performance: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-this-alias": ["error", { allowedNames: ["host"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["tests/browser/*.mjs"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        chrome: "readonly",
        location: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        XMLHttpRequest: "readonly",
        WebSocket: "readonly",
        history: "readonly",
        Response: "readonly",
        Blob: "readonly",
        PageTransitionEvent: "readonly",
        EventTarget: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        crypto: "readonly",
        queueMicrotask: "readonly",
      },
    },
  },
);
