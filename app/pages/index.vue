<script setup lang="ts">
useHead({ title: 'Meeting room booking' })
</script>

<template>
	<div class="bg-default min-h-screen">
		<div class="mx-auto max-w-3xl px-4 py-6 sm:py-10">
			<header class="mb-6">
				<p class="text-primary text-sm font-medium">Orion meeting room</p>
				<h1 class="text-highlighted text-2xl font-bold sm:text-3xl">
					Meeting room booking
				</h1>
				<p class="text-muted mt-1 text-sm">
					One room, working day 09:00–18:00, 15-minute steps. A booking lasts
					from 30 minutes to 2 hours.
				</p>
			</header>

			<ClientOnly>
				<BookingDayView />

				<template #fallback>
					<div class="space-y-4">
						<USkeleton class="h-28 w-full" />
						<USkeleton class="h-96 w-full" />
					</div>
				</template>
			</ClientOnly>
		</div>
	</div>
</template>
