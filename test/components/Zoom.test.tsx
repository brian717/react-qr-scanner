import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Zoom from '../../src/components/Zoom';

const capabilities = { min: 1, max: 5, step: 1 };

describe('Zoom', () => {
	it('renders nothing while not scanning', () => {
		const { container } = render(
			<Zoom
				scanning={false}
				capabilities={capabilities}
				value={3}
				onZoom={vi.fn()}
			/>,
		);

		expect(container.firstChild).toBeNull();
	});

	it('zooms in and out by one step, clamped to capabilities', () => {
		const onZoom = vi.fn();

		render(
			<Zoom scanning capabilities={capabilities} value={3} onZoom={onZoom} />,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(onZoom).toHaveBeenLastCalledWith(4);

		fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		expect(onZoom).toHaveBeenLastCalledWith(2);
	});

	it('disables zoom out at the minimum', () => {
		render(
			<Zoom scanning capabilities={capabilities} value={1} onZoom={vi.fn()} />,
		);

		expect(
			screen.getByRole<HTMLButtonElement>('button', { name: 'Zoom out' })
				.disabled,
		).toBe(true);
		expect(
			screen.getByRole<HTMLButtonElement>('button', { name: 'Zoom in' })
				.disabled,
		).toBe(false);
	});

	it('disables zoom in at the maximum', () => {
		render(
			<Zoom scanning capabilities={capabilities} value={5} onZoom={vi.fn()} />,
		);

		expect(
			screen.getByRole<HTMLButtonElement>('button', { name: 'Zoom in' })
				.disabled,
		).toBe(true);
	});
});
