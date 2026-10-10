import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				refetchOnWindowFocus: false,
				staleTime: 10_000,
			},
			mutations: {
				retry: false,
			},
		},
	})

	nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
})
