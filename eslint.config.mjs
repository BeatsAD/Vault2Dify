import { defineConfig } from 'eslint/config';
import json from '@eslint/json';
import obsidianmd from 'eslint-plugin-obsidianmd';
import tseslint from 'typescript-eslint';

const obsidianJsonRuleOverrides = Object.fromEntries(
	Object.keys(obsidianmd.rules).map((ruleName) => [`obsidianmd/${ruleName}`, 'off']),
);

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		files: ['**/*.json'],
		language: 'json/json',
		plugins: { json },
		rules: {
			...obsidianJsonRuleOverrides,
			'no-irregular-whitespace': 'off',
			'obsidianmd/validate-manifest': 'error',
		},
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: './tsconfig.json',
			},
		},
	},
]);
