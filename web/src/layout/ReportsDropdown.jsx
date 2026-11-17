import FilterButton from "../components/FilterButton";
import ReportFilterField from "./ReportFilterField";
import { translateText } from "../i18n/catalog";
import { useLanguageStore } from "../store/languageStore";

export const REPORT_TABS = [
  { key: "revenue", label: "Revenue" },
  { key: "registered-boats", label: "Registered Boats" },
  { key: "visiting-boats", label: "Visiting Boats" },
  { key: "boat-types", label: "Boat Types" },
  { key: "owner-info", label: "Boat Owner" },
  { key: "owner-signature", label: "Terms and Agreement" },
  { key: "boat-statement-report", label: "Boat Statement" },
  { key: "owner-statement-report", label: "Owner Statement" },
  { key: "collections", label: "Collections" },
  { key: "collection-deposit", label: "Collection & Deposits" },
  { key: "receivables", label: "Receivables" },
  { key: "docking", label: "Docking" },
  { key: "banyera", label: "Banyera" },
  { key: "fisheries-bfar", label: "Fisheries (BFAR)" },
  { key: "daily-vehicle-ticket", label: "Daily Vehicle Ticket" },
  { key: "vehicle-ticket", label: "Annual Vehicle Ticket" },
  { key: "billing", label: "Billing" },
  { key: "remittance", label: "Remittance" },
  { key: "fees", label: "Fees" },
];

export function getReportGroups(tabs, language) {
  const sortedTabs = tabs
    .map(({ key, label }) => ({ value: key, label: translateText(label, language) }))
    .sort((left, right) => left.label.localeCompare(right.label, language));
  const groups = new Map();

  for (const tab of sortedTabs) {
    const letter = tab.label.charAt(0).toLocaleUpperCase(language);
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(tab);
  }

  return Array.from(groups, ([label, options]) => ({ label, options }));
}

export default function ReportsDropdown({ activeKey, onChange, tabs = REPORT_TABS }) {
  const language = useLanguageStore((state) => state.language);

  return (
    <ReportFilterField label="Type of Report">
      <FilterButton
        width="100%"
        height={46}
        placeholder="Select Type of Report"
        value={activeKey ?? null}
        onChange={onChange}
        options={getReportGroups(tabs, language)}
      />
    </ReportFilterField>
  );
}
