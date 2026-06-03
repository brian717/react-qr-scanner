/** Theming options for the built-in finder overlay. */
export interface IFinderConfig {
	/** Stroke color of the finder corners and dashed box. Default `#ef4444`. */
	color?: string;
	/** Box size as a CSS dimension, e.g. `'70%'` or `'240px'`. Default `'70%'`. */
	size?: string;
	/** Border radius of the finder box. Default `'0.5rem'`. */
	borderRadius?: string;
}
