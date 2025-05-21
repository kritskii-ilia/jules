module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true }, // Added node: true for .cjs file itself
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier' // Make sure prettier is last
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'vite.config.ts'], // Added vite.config.ts
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }], // Warn for unused vars, ignore if prefixed with _
  },
};
