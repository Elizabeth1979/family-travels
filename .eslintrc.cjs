module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script"
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
  }
};
