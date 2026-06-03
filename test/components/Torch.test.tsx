import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Torch from '../../src/components/Torch';

describe('Torch', () => {
	it('renders nothing while not scanning', () => {
		const { container } = render(
			<Torch scanning={false} status={false} torchToggle={vi.fn()} />,
		);

		expect(container.firstChild).toBeNull();
	});

	it('turns the torch on when currently off', () => {
		const torchToggle = vi.fn();

		render(<Torch scanning status={false} torchToggle={torchToggle} />);

		const button = screen.getByRole('button', { name: 'Turn flashlight on' });
		expect(button.getAttribute('aria-pressed')).toBe('false');

		fireEvent.click(button);

		expect(torchToggle).toHaveBeenCalledWith(true);
	});

	it('turns the torch off when currently on', () => {
		const torchToggle = vi.fn();

		render(<Torch scanning status torchToggle={torchToggle} />);

		const button = screen.getByRole('button', { name: 'Turn flashlight off' });
		expect(button.getAttribute('aria-pressed')).toBe('true');

		fireEvent.click(button);

		expect(torchToggle).toHaveBeenCalledWith(false);
	});
});
