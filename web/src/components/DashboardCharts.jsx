import { useId } from "react";
import ReactApexChart from "react-apexcharts";

export function DashboardTargetGauge({ value, options }) {
  return (
    <div className="relative mx-auto h-[184px] w-full max-w-[420px] overflow-hidden">
      <div className="absolute inset-x-0 top-[-48px]">
        <ReactApexChart type="radialBar" series={[value]} options={options} width="100%" height={280} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-5 text-center">
        <p className="m-0 text-[30px] font-bold leading-none tabular-nums text-slate-900">{value.toFixed(2)}%</p>
      </div>
    </div>
  );
}

export function DashboardDonut({
  title,
  items,
  emptyLabel,
  formatValue = (value) => value.toLocaleString("en-PH"),
  formatLabel = formatValue,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const centerX = 168;
  const centerY = 138;
  const radius = 83;
  const strokeWidth = 34;
  const outerRadius = radius + strokeWidth / 2;
  const elbowRadius = outerRadius + 9;
  const labelWidth = 59;
  const labelHeight = 58;
  const lastLabelY = 2 * centerY - labelHeight / 2;
  const circumference = 2 * Math.PI * radius;
  const positiveItems = items.filter((item) => item.value > 0);
  const total = positiveItems.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  const slices = positiveItems.map((item) => {
    const fraction = item.value / total;
    const angle = (offset + fraction / 2) * 2 * Math.PI - Math.PI / 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const slice = {
      ...item,
      length: fraction * circumference,
      offset: offset * circumference,
      side: x < 0 ? -1 : 1,
      tipX: centerX + x * outerRadius,
      tipY: centerY + y * outerRadius,
      elbowX: centerX + x * elbowRadius,
      elbowY: centerY + y * elbowRadius,
    };
    offset += fraction;
    return slice;
  });

  const labelPositions = [-1, 1].flatMap((side) => {
    const sideSlices = slices.filter((slice) => slice.side === side).sort((a, b) => a.elbowY - b.elbowY);
    let nextY = labelHeight / 2;
    return sideSlices.map((slice, index) => {
      const labelY = Math.min(Math.max(slice.elbowY, nextY), lastLabelY - labelHeight * (sideSlices.length - index - 1));
      const railX = centerX + side * (outerRadius + 3 + index * 2);
      nextY = labelY + labelHeight;
      return { ...slice, labelY, railX };
    });
  });

  return (
    <div className="flex h-full min-w-0 flex-col">
      <p id={titleId} className="m-0 text-center text-[13px] font-medium leading-tight text-slate-500">{title}</p>
      <div className="grid flex-1 place-items-center">
        <svg
          viewBox="0 0 336 276"
          className="block w-full max-w-[356px]"
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <desc id={descriptionId}>{items.map((item) => `${item.name}: ${formatValue(item.value)}`).join(", ")}</desc>
          <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
          {slices.map((slice) => (
            <circle
              key={slice.key}
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${slice.length} ${circumference}`}
              strokeDashoffset={-slice.offset}
              transform={`rotate(-90 ${centerX} ${centerY})`}
              pointerEvents="visibleStroke"
            >
              <title>{formatValue(slice.value)}</title>
            </circle>
          ))}
          {labelPositions.map(({ key, name, side, tipX, tipY, elbowX, elbowY, labelY, railX, value }) => (
            <g key={key} aria-hidden="true" pointerEvents="none">
              <path
                d={`M${centerX + side * 106},${labelY} H${railX} V${elbowY} H${elbowX} L${tipX},${tipY}`}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.4"
              />
              <foreignObject
                x={side < 0 ? 0 : 2 * centerX - labelWidth}
                y={labelY - labelHeight / 2}
                width={labelWidth}
                height={labelHeight}
              >
                <div
                  className={`flex h-full flex-col justify-center leading-tight ${side < 0 ? "text-right" : "text-left"}`}
                >
                  <span className="text-[13px] font-medium text-slate-600">{name}</span>
                  <span className="text-[15px] font-semibold tabular-nums text-slate-900">{formatLabel(value)}</span>
                </div>
              </foreignObject>
            </g>
          ))}
          {total === 0 && (
            <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[13px]">
              {emptyLabel}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
