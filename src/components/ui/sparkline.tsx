interface Props {
	data: number[];
	width?: number;
	height?: number;
	color?: string;
	strokeWidth?: number;
}

export function Sparkline({
	data,
	width = 80,
	height = 24,
	color = "var(--accent)",
	strokeWidth = 1.5,
}: Props) {
	if (data.length < 2) return null;

	const min = Math.min(...data);
	const max = Math.max(...data);
	const range = max - min || 1;

	// Map data points into SVG viewBox coordinates.
	// Pad 1px on each side so the stroke doesn't clip at the edges.
	const padX = strokeWidth;
	const padY = strokeWidth;
	const innerW = width - padX * 2;
	const innerH = height - padY * 2;
	const stepX = innerW / (data.length - 1);

	const points = data
		.map((value, i) => {
			const x = padX + i * stepX;
			const y = padY + innerH - ((value - min) / range) * innerH;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join(" ");

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden="true"
			className="shrink-0"
		>
			<polyline
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				points={points}
			/>
		</svg>
	);
}
