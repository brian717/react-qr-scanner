import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ControlFocusStyle, {
	CONTROL_FOCUS_CSS,
} from '../../src/components/ControlFocusStyle';

describe('ControlFocusStyle', () => {
	it('renders the shared focus-visible rule as a stylesheet', () => {
		const { container } = render(<ControlFocusStyle />);
		const style = container.querySelector('style');

		expect(style?.textContent).toBe(CONTROL_FOCUS_CSS);
		expect(CONTROL_FOCUS_CSS).toContain('.rqs-control:focus-visible');
	});
});
