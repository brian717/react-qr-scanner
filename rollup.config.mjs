import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default [
	{
		input: 'src/index.ts',
		output: [
			{
				dir: 'dist',
				format: 'cjs',
				entryFileNames: '[name].cjs.js',
				sourcemap: true,
			},
			{
				dir: 'dist',
				format: 'esm',
				entryFileNames: '[name].esm.mjs',
				sourcemap: true,
			},
		],
		plugins: [
			commonjs(),
			typescript({
				tsconfig: './tsconfig.json',
				compilerOptions: {
					declaration: true,
					declarationMap: true,
					declarationDir: 'dist',
					inlineSources: true,
				},
				exclude: ['**/stories/**', '**/*.test.ts', '**/*.test.tsx'],
			}),
		],
		external: (id) => {
			return (
				id.startsWith('react') ||
				id === 'barcode-detector' ||
				id.startsWith('barcode-detector/') ||
				id === 'webrtc-adapter'
			);
		},
	},
];
