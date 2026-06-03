import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		globals: true,
		include: ['test/**/*.test.{ts,tsx}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov', 'html'],
			include: ['src/**/*.{ts,tsx}'],
			exclude: ['src/**/index.ts', 'src/types/**', 'src/assets/**'],
			// Gate against regressions. Raise these as coverage improves.
			thresholds: {
				statements: 58,
				branches: 58,
				functions: 58,
				lines: 58,
			},
		},
	},
});
