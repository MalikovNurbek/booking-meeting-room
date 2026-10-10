import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
	rules: {
		curly: ['error', 'all'],
		eqeqeq: ['error', 'always'],
	},
})
	.override('nuxt/vue/rules', {
		rules: {
			'vue/multi-word-component-names': 'off',
		},
	})
	.append({
		ignores: ['.nuxt/**', '.output/**', 'coverage/**'],
	})
