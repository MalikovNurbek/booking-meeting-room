import { defineVitestProject } from '@nuxt/test-utils/config'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = {
	'#shared': fileURLToPath(new URL('./shared', import.meta.url)),
	'~~': fileURLToPath(new URL('./', import.meta.url)),
	'~': fileURLToPath(new URL('./app', import.meta.url)),
}

export default defineConfig({
	test: {
		projects: [
			{
				resolve: { alias },
				test: {
					name: 'unit',
					environment: 'node',
					include: ['tests/unit/**/*.test.ts'],
				},
			},
			{
				resolve: { alias },
				test: {
					name: 'server',
					environment: 'node',
					include: ['tests/server/**/*.test.ts'],
				},
			},
			await defineVitestProject({
				resolve: { alias },
				test: {
					name: 'nuxt',
					environment: 'nuxt',
					include: ['tests/nuxt/**/*.test.ts'],
					environmentOptions: {
						nuxt: {
							overrides: {
								pages: false,
							},
						},
					},
				},
			}),
		],
		coverage: {
			provider: 'v8',
			include: ['shared/**/*.ts', 'server/**/*.ts', 'app/**/*.{ts,vue}'],
			exclude: ['**/types/**', '**/*.d.ts'],
		},
	},
})
