import { useState, useEffect } from "react";
import OverviewCard from "../../components/Overview";
import Breadcrumbs from "../../components/Breadcrumbs";
import TitlePage from "../../components/TitlePage";

export const RB_getCreatedBy = (boat) => boat?.created_by ?? boat?.createdBy ?? null;

export const RB_getCreatedByLabel = (boat) => {
  const createdBy = RB_getCreatedBy(boat);
  if (!createdBy) return "-";

  const fullName = String(createdBy?.full_name || "").trim();
  if (fullName !== "") return fullName;

  const firstLast = [createdBy?.first_name, createdBy?.last_name].filter(Boolean).join(" ").trim();
  if (firstLast !== "") return firstLast;

  return String(createdBy?.email || "-").trim() || "-";
};

export const BM_getHighlightId = ({ highlightedSearchResult, group, prefix, search }) => {
  const stateId = highlightedSearchResult?.group === group ? String(highlightedSearchResult?.id || "") : "";
  const urlId = new URLSearchParams(search).get("highlight") || "";
  const rawId = stateId || urlId;

  return rawId.startsWith(prefix) ? rawId.slice(prefix.length) : "";
};

export const BM_clearUniversalHighlight = ({ highlightedSearchResult, location, navigate }) => {
  const params = new URLSearchParams(location.search);
  const hadHighlight = params.delete("highlight");

  if (!highlightedSearchResult && !hadHighlight) return;

  const nextSearch = params.toString();
  navigate(
    {
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : "",
    },
    { replace: true, state: null }
  );
};

export const BM_OverviewGrid = ({ stats, loading = false, columns = 5 }) => {
  const gridColsClass =
    columns === 1 ? "xl:grid-cols-1" :
    columns === 2 ? "xl:grid-cols-2" :
    columns === 3 ? "xl:grid-cols-3" :
    columns === 4 ? "xl:grid-cols-4" :
    "xl:grid-cols-5";

  return (
    <div className={`mb-5 grid grid-cols-1 gap-2 md:grid-cols-2 ${gridColsClass}`}>
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <OverviewCard
          key={label}
          title={label}
          value={value}
          icon={Icon}
          tone={tone}
          loading={loading}
          className="px-3 py-3"
        />
      ))}
    </div>
  );
};

export const BM_buildLocalMeta = (items = [], page = 1, perPage = 10) => {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, page), lastPage);
  const from = total ? (currentPage - 1) * perPage + 1 : 0;
  const to = total ? Math.min(currentPage * perPage, total) : 0;

  return {
    current_page: currentPage,
    last_page: lastPage,
    per_page: perPage,
    total,
    from,
    to,
  };
};

export const BM_useDebouncedValue = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
};

export const BM_Header = ({ title, subtitle, fontFamily, loading = false }) => (
  <div className="mb-5 flex items-center justify-between">
    <TitlePage title={title} subtitle={subtitle} loading={loading} />
    <Breadcrumbs items={[{ label: "Dashboard", to: "/dashboard" }, { label: title }]} fontFamily={fontFamily} loading={loading} />
  </div>
);
