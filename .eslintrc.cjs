module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  extends: [
    "eslint:recommended",
    "prettier"
  ],
  globals: {
    CONFIG: "readonly",
    L: "readonly",
    PhotoSwipeLightbox: "readonly",
    PhotoSwipe: "readonly"
  },
  rules: {
    "no-console": "off",
    "prefer-const": [
      "error",
      {
        destructuring: "all"
      }
    ],
    "no-unused-vars": [
      "warn",
      {
        args: "none",
        ignoreRestSiblings: true
      }
    ]
  },
  overrides: [
    {
      files: ["*.config.js", "vite.config.js", "postcss.config.js", "tailwind.config.js"],
      env: {
        node: true
      }
    }
  ]
};
