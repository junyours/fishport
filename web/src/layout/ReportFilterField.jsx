import { cloneElement, useId } from "react";

export default function ReportFilterField({ label, children }) {
  const id = useId();

  return (
    <div className="flex w-full flex-col gap-1.5 md:w-[260px]">
      <label htmlFor={id} className="m-0 text-[11px] font-semibold uppercase text-[#8C8CA0]">{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
