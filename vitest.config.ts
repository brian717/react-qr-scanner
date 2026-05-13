import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		globals: true,
		include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov', 'html'],
			include: ['src/**/*.{ts,tsx}'],
			exclude: [
				'src/**/*.test.{ts,tsx}',
				'src/**/index.ts',
				'src/types/**',
				'src/assets/**',
			],
		},
	},
});
