// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const fs = require('node:fs');
const path = require('node:path');

// Import boundaries (see ANGULAR_MIGRATION_PLAN.md "Dependency rules"):
//  - features must not import other features
//  - shared must not import core or features
const featuresDir = path.join(__dirname, 'src/app/features');
const featureNames = fs.existsSync(featuresDir)
  ? fs.readdirSync(featuresDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

const featureBoundaries = featureNames.map((name) => {
  const others = featureNames.filter((n) => n !== name);
  return {
    files: [`src/app/features/${name}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@features/*', ...others.flatMap((o) => [`**/features/${o}`, `**/features/${o}/**`, `../${o}`, `../${o}/**`, `../../${o}`, `../../${o}/**`])],
              message: 'A feature must not import another feature. Move shared code to shared/ or core/.',
            },
          ],
        },
      ],
    },
  };
});

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  ...featureBoundaries,
  {
    files: ['src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@core/*', '@features/*', '**/app/core/**', '../core/**', '../../core/**', '**/features/**'],
              message: 'shared must not import from core or features.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
