module.exports = {
  'root': true,
  'env': {
    es2021: true,
    node: true,
  },
  'settings': {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  'extends': [
    'marine/node',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  'parserOptions': {
    ecmaVersion: 2021,
    sourceType: 'module',
    parser: '@typescript-eslint/parser',
    project: './tsconfig.eslint.json',
  },
  'ignorePatterns': ['**/dist/*'],
  'plugins': ['@typescript-eslint', 'import'],

  // -> You will most likely have to add rules on as you go.
  // There are many broken things out of the box. Also its tuned to
  // how I prefer to style.
  'rules': {
    'indent': 'off',
    '@typescript-eslint/indent': ['error', 2],
    'quotes': 'off',
    '@typescript-eslint/quotes': ['error', 'single'],
    'comma-dangle': 'off',
    '@typescript-eslint/comma-dangle': ['error', 'always-multiline'],
    'semi': 'off',
    '@typescript-eslint/semi': ['error', 'never'],
  },
}
