import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OnOff from '../../src/components/OnOff';

describe('OnOff', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows the "on" affordance when stopped and starts on click', () => {
		const startScanning = vi.fn();
		const stopScanning = vi.fn();

		render(
			<OnOff
				scanning={false}
				startScanning={startScanning}
				stopScanning={stopScanning}
			/>,
		);

		const button = screen.getByRole('button', { name: 'Turn camera on' });
		expect(button.getAttribute('aria-pressed')).toBe('false');

		fireEvent.click(button);

		expect(startScanning).toHaveBeenCalledTimes(1);
		expect(stopScanning).not.toHaveBeenCalled();
	});

	it('shows the "off" affordance when scanning and stops on click', () => {
		const startScanning = vi.fn();
		const stopScanning = vi.fn();

		render(
			<OnOff
				scanning
				startScanning={startScanning}
				stopScanning={stopScanning}
			/>,
		);

		const button = screen.getByRole('button', { name: 'Turn camera off' });
		expect(button.getAttribute('aria-pressed')).toBe('true');

		fireEvent.click(button);

		expect(stopScanning).toHaveBeenCalledTimes(1);
	});

	it('debounces rapid toggles by disabling the button for ~1s', () => {
		vi.useFakeTimers();

		const startScanning = vi.fn();

		render(
			<OnOff
				scanning={false}
				startScanning={startScanning}
				stopScanning={vi.fn()}
			/>,
		);

		const button = screen.getByRole<HTMLButtonElement>('button');

		fireEvent.click(button);
		expect(button.disabled).toBe(true);

		// A second click while disabled is ignored.
		fireEvent.click(button);
		expect(startScanning).toHaveBeenCalledTimes(1);

		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(button.disabled).toBe(false);
	});
});
