import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
	compatibilityDate: '2026-10-01',

	modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxt/test-utils/module'],

	css: ['~/assets/css/main.css'],

	devtools: { enabled: true },

	typescript: {
		strict: true,
		typeCheck: false,
	},

	future: {
		compatibilityVersion: 4,
	},

	app: {
		head: {
			htmlAttrs: { lang: 'en' },
			title: 'Meeting room booking',
			meta: [
				{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
				{
					name: 'description',
					content:
						'Meeting room booking interface for a 09:00–18:00 working day',
				},
			],
		},
	},
})
