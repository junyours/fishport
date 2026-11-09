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

export function DashboardDonut({ title, series, options, total, items, percentages = false }) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <p className="m-0 text-center text-[13px] font-medium leading-tight text-slate-500">{title}</p>
      <div className="relative mx-auto my-3 h-[224px] w-full max-w-[280px]">
        <ReactApexChart type="donut" series={series} options={options} width="100%" height={224} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          <p className="m-0 text-[11px] font-medium text-slate-500">Total</p>
          <p className="m-0 mt-1 max-w-full break-words text-[24px] font-bold leading-tight tabular-nums text-slate-900">{total}</p>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2.5">
        {items.map((item) => (
          <div key={item.key} className="flex min-w-0 items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{percentages ? `${item.percent}%` : item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
