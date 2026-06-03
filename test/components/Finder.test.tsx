import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Finder from '../../src/components/Finder';

const baseProps = {
	scanning: true,
	startScanning: vi.fn(),
	stopScanning: vi.fn(),
};

describe('Finder', () => {
	it('renders the overlay without controls by default', () => {
		render(<Finder {...baseProps} capabilities={{}} />);

		expect(screen.queryByRole('button')).toBeNull();
	});

	it('renders the on/off control when enabled', () => {
		render(<Finder {...baseProps} capabilities={{}} onOff />);

		expect(screen.getByRole('button', { name: /camera/i })).toBeTruthy();
	});

	it('only renders the torch control when the device supports it', () => {
		const torch = { status: false, toggle: vi.fn() };

		const { rerender } = render(
			<Finder {...baseProps} capabilities={{}} torch={torch} />,
		);
		expect(screen.queryByRole('button', { name: /flashlight/i })).toBeNull();

		rerender(
			<Finder {...baseProps} capabilities={{ torch: true }} torch={torch} />,
		);
		expect(screen.getByRole('button', { name: /flashlight/i })).toBeTruthy();
	});

	it('only renders the zoom control when the device supports it', () => {
		const zoom = { value: 2, onChange: vi.fn() };

		render(
			<Finder
				{...baseProps}
				capabilities={{ zoom: { min: 1, max: 5, step: 1 } }}
				zoom={zoom}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();
	});

	it('applies a custom finder color', () => {
		const { container } = render(
			<Finder {...baseProps} capabilities={{}} color="#00ff00" />,
		);

		expect(container.innerHTML).toContain('#00ff00');
	});
});
