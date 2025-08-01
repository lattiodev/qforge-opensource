module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
  ],
  rules: {
    'no-unused-vars': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'default-case': 'off',
    'no-dupe-keys': 'off',
    'no-useless-escape': 'off',
    'no-unreachable': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-empty': 'off',
    'no-unused-expressions': 'off',
    'no-unused-labels': 'off',
    'no-unused-imports': 'off',
    'no-unused-vars': 'off',

  },
  settings: {
    react: {
      version: 'detect'
    }
  }
} 