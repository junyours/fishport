import React, { useState, useEffect, useRef, useCallback } from "react";
import { Tooltip } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import "typeface-montserrat";
import {
  IoAddOutline,
  IoPersonOutline,
  IoLocationOutline,
  IoCalendarOutline,
  IoCallOutline,
  IoDocumentTextOutline,
  IoCloseOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoArchiveOutline,
  IoCheckmarkOutline,
  IoAlertCircleOutline,
  IoPeopleOutline,
} from "react-icons/io5";
import Sidebar from "../../layout/Sidebar";
import Topbar from "../../layout/Topbar";
import StatusPill from "../../components/StatusPill";
import DetailDrawer, { DrawerInfoCard, DrawerSection } from "../../components/Drawer";
import FilterButton from "../../components/FilterButton";
import Modal, { ModalTextInput } from "../../components/Modal";
import TableCard from "../../components/TableCard";
import Tabs from "../../components/Tabs";
import Spinner from "../../components/Spinner";
import NoDataFound from "../../components/NoDataFound";
import ArchiveModal from "../../components/ArchiveModal";
import { showAddedToast, showBottomToast, showNoChangesToast, showUpdatedToast } from "../../store/bottomToastStore";
import { useSidebar } from "../../store/sidebarStore";
import api from "../../api/axios";
import { buildOwnerStatementPdf } from "../../lib/pdfDocumentOwnerStatement";
import { useBoatOwnersQuery } from "../../hooks/useBoatManagement";
import { getStatementOfAccountDataQueryOptions } from "../../hooks/useStatementOfAccountDataQuery";
import { useTransactionLockQuery } from "../../hooks/useTransactionLockQuery";
import { addOwnerToDataCache, archiveOwnerInDataCache, updateOwnerInDataCache } from "../../utils/boatManagementCache";
import { isHeadRole } from "../../utils/transactionLock";
import {
  RB_getCreatedByLabel,
  BM_getHighlightId,
  BM_clearUniversalHighlight,
  BM_OverviewGrid,
  BM_buildLocalMeta,
  BM_useDebouncedValue,
  BM_Header,
} from "../../features/boat-management/shared";

const BO_buildOverviewStats = (owners = [], stats = {}) => [
  {
    label: "Total Boat Owner",
    value: stats.total_owners ?? owners.length,
    icon: IoPeopleOutline,
    tone: "blue",
  },
  {
    label: "Boat Owner in Use",
    value: stats.boat_owners_in_use ?? owners.filter((owner) => Number(owner?.boats_count ?? 0) > 0).length,
    icon: IoCheckmarkOutline,
    tone: "green",
  },
  {
    label: "Boat Owner Not in Use",
    value: stats.boat_owners_not_in_use ?? owners.filter((owner) => Number(owner?.boats_count ?? 0) === 0).length,
    icon: IoCloseOutline,
    tone: "amber",
  },
];

const BO_FONT         = "'Montserrat', sans-serif";

const BO_PAGE_SIZE    = 10;

const BO_FOCUS_COLOR  = "#4096ff";

const BO_FOCUS_SHADOW = "none";

const BO_OWNER_STATUS_OPTIONS = [
  { value: "all", label: "All Owners" },
  { value: "used", label: "Used" },
  { value: "unused", label: "Unused" },
];

const BO_getFullName = (owner) =>
  `${owner?.owner_firstname ?? ""} ${owner?.owner_lastname ?? ""}`.trim() || "-";

const BO_normalizeOwnerName = (firstName, lastName) => {
  const normalized = [firstName, lastName]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return normalized.toLowerCase();
};

const BO_getUsageCount = (owner) => Number(owner?.boats_count ?? 0);

const BO_getUsageCountLabel = (owner) => {
  const count = BO_getUsageCount(owner);
  return `${count} ${count <= 1 ? "count" : "counts"}`;
};

const BO_formatDate = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
};

const BO_Spinner = Spinner;

const BO_Field = ({ label, required, error, children }) => (
  <div>
    <p
      className="m-0 mb-2 text-[11px] font-semibold uppercase"
      style={{ color: "#6F6F82", fontFamily: BO_FONT }}
    >
      {label}{required && <span className="text-red-500 ml-0.5"> *</span>}
    </p>
    <div className={error ? "modal-field-control-error" : ""}>{children}</div>
    {error && (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 mt-2">
        <IoAlertCircleOutline className="text-red-400 text-[14px] flex-shrink-0" />
        <p className="m-0 text-[12px] font-normal text-red-600" style={{ fontFamily: BO_FONT }}>{error}</p>
      </div>
    )}
  </div>
);

const BO_FieldInput = React.forwardRef(({ icon: Icon, placeholder, value, onChange }, ref) => (
  <div
    className="modal-input-shell flex items-center gap-3 px-4 rounded-xl border border-slate-200 bg-white transition-all"
    style={{ height: 46 }}
    onFocus={(e) => { e.currentTarget.style.borderColor = BO_FOCUS_COLOR; e.currentTarget.style.boxShadow = BO_FOCUS_SHADOW; }}
    onBlur={(e)  => { e.currentTarget.style.borderColor = "#e2e8f0";   e.currentTarget.style.boxShadow = "none"; }}
  >
    {Icon && <Icon className="text-slate-400 flex-shrink-0" style={{ fontSize: 16 }} />}
    <input
      ref={ref} value={value} onChange={onChange} placeholder={placeholder}
      className="border-none outline-none text-[14px] font-medium w-full bg-transparent"
      style={{ fontFamily: BO_FONT, color: "#0d1117" }}
    />
  </div>
));

const BO_TailDropdown = ({ value, onChange, options, height = 38 }) => (
  <FilterButton value={value} onChange={onChange} options={options} height={height} width={160} />
);

const BO_OwnerDrawer = ({ owner, open, onClose, onSave, onNoChanges, saving, owners = [] }) => {
  const isEdit = !!owner;
  const [form, setForm] = useState({
    owner_firstname: owner?.owner_firstname || "",
    owner_lastname:  owner?.owner_lastname  || "",
    contact_number:  owner?.contact_number  || "",
    address:         owner?.address         || "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm({
      owner_firstname: owner?.owner_firstname || "",
      owner_lastname:  owner?.owner_lastname  || "",
      contact_number:  owner?.contact_number  || "",
      address:         owner?.address         || "",
    });
    setErrors({});
  }, [owner, open]);

  const setField = (key) => (e) => {
    const value =
      key === "contact_number"
        ? e.target.value.replace(/\D/g, "").slice(0, 11)
        : e.target.value;

    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    const firstName = form.owner_firstname.trim();
    const lastName = form.owner_lastname.trim();

    if (!firstName) e.owner_firstname = "First name is required.";
    if (!lastName) e.owner_lastname = "Last name is required.";
    if (!form.address.trim()) e.address = "Address is required.";
    if (form.contact_number.trim() && !/^\d{11}$/.test(form.contact_number.trim())) {
      e.contact_number = "Contact number must be 11 digits.";
    }

    const normalizedName = BO_normalizeOwnerName(firstName, lastName);
    if (normalizedName && !e.owner_firstname && !e.owner_lastname) {
      const duplicateOwner = owners.some((existingOwner) => {
        if (isEdit && String(existingOwner.owner_id) === String(owner?.owner_id)) return false;
        return BO_normalizeOwnerName(existingOwner?.owner_firstname, existingOwner?.owner_lastname) === normalizedName;
      });

      if (duplicateOwner) {
        e.owner_firstname = "An owner with this first and last name already exists.";
        e.owner_lastname = "An owner with this first and last name already exists.";
      }
    }

    return e;
  };

  const hasChanges = () => {
    if (!isEdit) return true;
    return (
      form.owner_firstname.trim() !== (owner.owner_firstname || "").trim() ||
      form.owner_lastname.trim()  !== (owner.owner_lastname  || "").trim() ||
      form.address.trim()         !== (owner.address         || "").trim() ||
      form.contact_number.trim()  !== (owner.contact_number  || "").trim()
    );
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (isEdit && !hasChanges()) { onNoChanges?.(); return; }
    await onSave({
      owner_firstname: form.owner_firstname,
      owner_lastname:  form.owner_lastname,
      address:         form.address,
      contact_number:  form.contact_number,
    });
  };

  if (!open) return null;

  return (
    <Modal
      title={isEdit ? "Edit Owner" : "Add Owner"}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel={isEdit ? "Save" : "Add"}
      maxWidth="620px"
      closeOnBackdrop
    >
      <div className="grid grid-cols-2 gap-3">
        <ModalTextInput
          label={
            <>
              First Name <span className="text-red-500">*</span>
            </>
          }
          value={form.owner_firstname}
          onChange={setField("owner_firstname")}
          placeholder="Enter your first name"
          icon={IoPersonOutline}
          error={errors.owner_firstname}
          inputStyle={{ fontFamily: BO_FONT }}
        />
        <ModalTextInput
          label={
            <>
              Last Name <span className="text-red-500">*</span>
            </>
          }
          value={form.owner_lastname}
          onChange={setField("owner_lastname")}
          placeholder="Enter your last name"
          icon={IoPersonOutline}
          error={errors.owner_lastname}
          inputStyle={{ fontFamily: BO_FONT }}
        />
      </div>
      <ModalTextInput
        label={
          <>
            Address <span className="text-red-500">*</span>
          </>
        }
        value={form.address}
        onChange={setField("address")}
        placeholder="Enter your address"
        icon={IoLocationOutline}
        error={errors.address}
        inputStyle={{ fontFamily: BO_FONT }}
      />
      <ModalTextInput
        label="Contact Number (Optional)"
        value={form.contact_number}
        onChange={setField("contact_number")}
        placeholder="Enter your contact number"
        icon={IoCallOutline}
        error={errors.contact_number}
        inputStyle={{ fontFamily: BO_FONT }}
      />
    </Modal>
  );
};

const BO_TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#1a1f36", backgroundColor: "#ffffff", borderBottom: "2px solid #e5e7eb" }}>
    {children}
  </th>
);

const BO_normalizeTransactionLabel = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "ticket") return "Vehicle Ticket";
  if (normalized === "banyera") return "Banyera";
  if (normalized === "docking") return "Docking";
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const BO_buildBoatStatementTransactions = (boatDetailRecord) => {
  if (!boatDetailRecord) return [];

  const transactions = [];
  const getPaymentDescription = (bill, payment) => {
    const totalAmount = Number(bill?.total_amount || bill?.balance_due || bill?.amount_due || 0);
    const amountPaid = Number(payment?.amount_paid || 0);
    const balanceAfterPayment = Math.max(0, totalAmount - amountPaid);

    return balanceAfterPayment <= 0.009 ? "Full Payment Received" : "Partial Payment Received";
  };

  (boatDetailRecord.bills || []).forEach((bill) => {
    (Array.isArray(bill.line_items) ? bill.line_items : [])
      .filter((item) => ["docking", "banyera", "ticket"].includes(String(item.transaction_type || "").toLowerCase()))
      .forEach((item, index) => {
        const transactionType = String(item.transaction_type || "").toLowerCase();
        const feeLabel = transactionType === "ticket"
          ? "Vehicle Ticket Fee"
          : `${BO_normalizeTransactionLabel(transactionType)} Fee`;

        transactions.push({
          transaction_key: `charge-${bill.bill_id}-${transactionType}-${index}`,
          date: bill.date_billed,
          bill_reference: bill.bill_reference,
          type: "Bill",
          reference: "-",
          description: feeLabel,
          charge: Number(item.amount || 0),
          payment: 0,
        });
      });

    (bill.payments || [])
      .slice()
      .sort((a, b) => String(a.payment_date || "").localeCompare(String(b.payment_date || "")))
      .forEach((payment, index) => {
        transactions.push({
          transaction_key: `payment-${bill.bill_id}-${payment.payment_id ?? index}`,
          date: payment.payment_date,
          bill_reference: bill.bill_reference,
          type: "Payment",
          reference: String(
            payment.payment_reference_no ||
            payment.payment_reference ||
            payment.reference_no ||
            payment.reference_number ||
            payment.official_receipt_no ||
            payment.official_receipt_number ||
            payment.or_no ||
            payment.or_number ||
            payment.receipt_no ||
            payment.receipt_number ||
            "-"
          ),
          description: getPaymentDescription(bill, payment),
          charge: 0,
          payment: Number(payment.amount_paid || 0),
        });
      });
  });

  (boatDetailRecord.unbilled_charges || []).forEach((charge) => {
    transactions.push(charge);
  });

  const sortedTransactions = transactions.sort((a, b) => {
    const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCompare !== 0) return dateCompare;
    if (a.type === b.type) return 0;
    if (a.type === "Bill") return -1;
    if (b.type === "Bill") return 1;
    if (a.type === "Unbilled") return -1;
    if (b.type === "Unbilled") return 1;
    return 1;
  });

  let runningBalance = 0;
  return sortedTransactions.map((transaction) => {
    runningBalance += Number(transaction.charge || 0) - Number(transaction.payment || 0);
    return { ...transaction, running_balance: runningBalance };
  });
};

const BO_getBoatStatementPeriod = (transactions) => {
  if (!transactions.length) return "-";
  const dates = transactions
    .map((transaction) => String(transaction.date || "").slice(0, 10))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  if (!dates.length) return "-";
  if (dates[0] === dates[dates.length - 1]) return BO_formatDate(dates[0]);
  return `${BO_formatDate(dates[0])} - ${BO_formatDate(dates[dates.length - 1])}`;
};

const BO_OwnerStatementModal = ({ owner, open, onClose }) => {
  const queryClient = useQueryClient();
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !owner) {
      setPdfFile((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return null;
      });
      setLoading(false);
      return undefined;
    }

    let isActive = true;
    let nextUrl = "";

    setPdfFile((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });

    const generateOwnerStatementPdf = async () => {
      setLoading(true);
      try {
        const ownerStatementData = await queryClient.fetchQuery({
          ...getStatementOfAccountDataQueryOptions({
            statementType: "owners",
            ownerId: String(owner.owner_id),
            perPage: BO_PAGE_SIZE,
          }),
        });
        const record = ownerStatementData?.ownerRecords?.[0] ?? {
          owner_key: String(owner.owner_id),
          owner_id: owner.owner_id,
          owner_name: BO_getFullName(owner),
          contact_number: owner.contact_number,
          address: owner.address,
          boats: [],
          total_billed: 0,
          total_collected: 0,
          total_receivables: 0,
        };
        const boatStatements = await Promise.all(
          (record?.boats ?? []).map(async (boat) => {
            const detailData = await queryClient.fetchQuery({
              ...getStatementOfAccountDataQueryOptions({
                boat: String(boat?.boat_key ?? boat?.boat_id ?? ""),
                perPage: 100,
                selectedOnly: true,
              }),
            });
            const detailRecord = detailData?.selectedBoatRecord ?? boat;
            const transactions = BO_buildBoatStatementTransactions(detailRecord);
            return {
              boat: detailRecord,
              transactions,
              periodLabel: BO_getBoatStatementPeriod(transactions),
            };
          })
        );
        const pdfBytes = await buildOwnerStatementPdf({ record, boatStatements });

        if (!isActive) return;

        const nextData =
          pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
        const safeOwnerName = BO_getFullName(owner)
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || "boat-owner";
        const filename = `owner-statement-${safeOwnerName}.pdf`;
        const file = new File([nextData], filename, {
          type: "application/pdf",
        });

        nextUrl = URL.createObjectURL(file);
        setPdfFile({ url: nextUrl, filename });
      } catch (error) {
        console.error("Failed to generate owner statement PDF", error);
        if (isActive) setPdfFile(null);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    generateOwnerStatementPdf();

    return () => {
      isActive = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [open, owner, queryClient]);

  if (!open) return null;

  return (
    <Modal
      title="Owner Statement"
      onClose={onClose}
      closeOnBackdrop
      maxWidth="920px"
      showFooter={false}
      bodyClassName="h-[68vh] max-h-[68vh] !overflow-hidden !p-0"
      contentClassName="h-full !gap-0"
    >
      <div className="relative h-full overflow-hidden bg-white">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white px-6 text-center text-[13px] text-slate-500">
            Generating PDF preview...
          </div>
        ) : pdfFile?.url ? (
          <iframe
            src={pdfFile.url}
            title={`Owner Statement ${BO_getFullName(owner)}`}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white px-6 text-center text-[13px] text-slate-500">
            Generating PDF preview...
          </div>
        )}
      </div>
    </Modal>
  );
};

const BO_OwnerDetailsDrawer = ({ owner, open, onClose }) => {
  const [ownerStatementOpen, setOwnerStatementOpen] = useState(false);

  if (!owner) return null;

  return (
    <>
      <DetailDrawer
        open={open}
        onClose={onClose}
        width={460}
        fontFamily={BO_FONT}
        title="Owner Details"
        subtitle="Review the selected boat owner record."
        icon={IoPersonOutline}
        footer={
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                onClose?.();
                setOwnerStatementOpen(true);
              }}
              className="inline-flex min-w-[260px] items-center justify-center gap-2 rounded-[10px] border border-[#1a1f36] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#1a1f36] transition-colors hover:bg-slate-50"
              style={{ fontFamily: BO_FONT }}
            >
              <IoDocumentTextOutline className="text-[16px]" />
              View Owner Statement
            </button>
          </div>
        }
      >
        <DrawerSection
          icon={IoDocumentTextOutline}
          title="Owner Info"
          subtitle="Registered details for this boat owner"
          fontFamily={BO_FONT}
        >
          <div className="grid grid-cols-1 gap-3">
            <DrawerInfoCard label="Full Name" value={BO_getFullName(owner)} />
            <DrawerInfoCard label="Address" value={owner.address ?? "-"} />
            <DrawerInfoCard label="Contact Number" value={owner.contact_number ?? "-"} />
          </div>
        </DrawerSection>
        <DrawerSection
          icon={IoCalendarOutline}
          title="Created Details"
          subtitle="Record creation information"
          fontFamily={BO_FONT}
        >
          <div className="grid grid-cols-1 gap-3">
            <DrawerInfoCard label="Created By" value={RB_getCreatedByLabel(owner)} />
            <DrawerInfoCard label="Date Added" value={BO_formatDate(owner.created_at)} />
          </div>
        </DrawerSection>
      </DetailDrawer>

      <BO_OwnerStatementModal
        owner={owner}
        open={ownerStatementOpen}
        onClose={() => setOwnerStatementOpen(false)}
      />
    </>
  );
};

const BO_BoatOwners = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const highlightedSearchResult = location.state?.universalSearchResult ?? null;
  const cachedRegisteredBoatsData = queryClient.getQueriesData({ queryKey: ["registered-boats-data"] })
    .find(([, data]) => data?.owners)?.[1];
  const [activeItem,    setActiveItem]    = useState("Boat Management");
  const [contentMargin, setContentMargin] = useState(() => window.innerWidth >= 900 ? 256 : 0);
  const [owners,        setOwners]        = useState(() => cachedRegisteredBoatsData?.owners ?? []);
  const [search,        setSearch]        = useState("");
  const [ownerStatusFilter, setOwnerStatusFilter] = useState("all");
  const [requestedPage, setRequestedPage] = useState(1);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [toast,         setToast]         = useState({ open: false, type: "success", title: "", message: "" });
  const [addModal,      setAddModal]      = useState(false);
  const { isTransactionLocked, transactionLockMessage } = useTransactionLockQuery("boat-management");
  const isHeadViewOnly = isHeadRole();
  const [editOwner,     setEditOwner]     = useState(null);
  const [deleteOwner,   setDeleteOwner]   = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [fetching,      setFetching]      = useState(() => !cachedRegisteredBoatsData?.owners);
  const [saving,        setSaving]        = useState(false);
  const urlFiltersKeyRef = useRef(null);

  const debouncedSearch = BM_useDebouncedValue(search);
  const rawHighlightedOwnerId = BM_getHighlightId({
    highlightedSearchResult,
    group: "Boat Owner",
    prefix: "boat-owner-",
    search: location.search,
  });
  const highlightToken = rawHighlightedOwnerId
    ? `${rawHighlightedOwnerId}|${location.search}|${highlightedSearchResult?.group || ""}`
    : "";
  const [dismissedHighlightToken, setDismissedHighlightToken] = useState("");
  const highlightedOwnerId = dismissedHighlightToken === highlightToken ? "" : rawHighlightedOwnerId;
  const clearUniversalHighlight = useCallback(() => {
    if (highlightToken) {
      setDismissedHighlightToken(highlightToken);
    }
    BM_clearUniversalHighlight({ highlightedSearchResult, location, navigate });
  }, [highlightToken, highlightedSearchResult, location, navigate]);
  useEffect(() => {
    setDismissedHighlightToken("");
  }, [location.key]);
  const boatOwnersQuery = useBoatOwnersQuery(
    {
      page: currentPage,
      perPage: BO_PAGE_SIZE,
      search: debouncedSearch,
      usage: ownerStatusFilter,
      highlightOwnerId: highlightedOwnerId,
    }
  );
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleSidebar } = useSidebar();
  const handleWidthChange = useCallback((w) => setContentMargin(w), []);

  useEffect(() => {
    setFetching(boatOwnersQuery.isLoading && owners.length === 0);
  }, [owners.length, boatOwnersQuery.isLoading]);

  useEffect(() => {
    if (window.innerWidth >= 900 && sidebarOpen)
      setContentMargin(sidebarCollapsed ? 72 : 256);
    else if (window.innerWidth < 900) setContentMargin(0);
  }, [sidebarCollapsed, sidebarOpen]);

  const showToast = (type, title, message) => {
    if (type === "info" && title === "No Changes Made") {
      showNoChangesToast();
      return;
    }
    showBottomToast(type, title, message);
  };

  useEffect(() => {
    if (boatOwnersQuery.data) {
      setOwners(boatOwnersQuery.data.owners);
    }
  }, [boatOwnersQuery.data]);

  useEffect(() => {
    if (!highlightedOwnerId) return;
    const resolvedPage = Number(boatOwnersQuery.data?.ownersMeta?.current_page || 0);
    if (resolvedPage > 0 && (resolvedPage !== currentPage || resolvedPage !== requestedPage)) {
      setRequestedPage(resolvedPage);
      setCurrentPage(resolvedPage);
    }
  }, [currentPage, highlightedOwnerId, boatOwnersQuery.data?.ownersMeta?.current_page, requestedPage]);

  useEffect(() => {
    if (boatOwnersQuery.isError) {
      showToast("error", "Error", "Failed to load boat owners.");
    }
  }, [boatOwnersQuery.isError]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextSearch = params.get("q") || "";
    const nextUrlFiltersKey = JSON.stringify({ search: nextSearch });
    const filtersChanged = urlFiltersKeyRef.current !== null && urlFiltersKeyRef.current !== nextUrlFiltersKey;
    urlFiltersKeyRef.current = nextUrlFiltersKey;

    setSearch(nextSearch);

    if (filtersChanged) {
      setCurrentPage(1);
    }
  }, [highlightedSearchResult, location.search]);

  const handleAdd = async (form) => {
    if (isHeadViewOnly) return;
    if (isTransactionLocked) { showToast("error", "Transactions Locked", transactionLockMessage); return; }
    setSaving(true);
    try {
      const res = await api.post("/boat-owners", form);
      setOwners((prev) => [res.data, ...prev]);
      queryClient.setQueryData(["boat-owners"], (prev = []) => [res.data, ...prev]);
      addOwnerToDataCache(queryClient, res.data);
      setAddModal(false);
      showAddedToast("Boat Owner", "boat owner");
      void queryClient.invalidateQueries({ queryKey: ["dockings-data"], refetchType: "active" });
      void queryClient.invalidateQueries({ queryKey: ["registered-boats-report"], refetchType: "active" });
      void queryClient.invalidateQueries({ queryKey: ["boat-types-report"], refetchType: "active" });
      void queryClient.invalidateQueries({ queryKey: ["owner-info-report"], refetchType: "active" });
    } catch (err) {
      showToast("error", "Failed to Add", err.response?.data?.message ?? "Failed to add owner.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (form) => {
    if (isHeadViewOnly) return;
    if (isTransactionLocked) { showToast("error", "Transactions Locked", transactionLockMessage); return; }
    setSaving(true);
    try {
      const res = await api.put(`/boat-owners/${editOwner.owner_id}`, form);
      setOwners((prev) => prev.map((o) => o.owner_id === editOwner.owner_id ? res.data : o));
      setSelectedOwner((prev) => (prev?.owner_id === editOwner.owner_id ? res.data : prev));
      queryClient.setQueryData(["boat-owners"], (prev = []) =>
        prev.map((o) => (o.owner_id === editOwner.owner_id ? res.data : o))
      );
      updateOwnerInDataCache(queryClient, res.data);
      setEditOwner(null);
      showUpdatedToast("Boat Owner", "boat owner");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["boat-owners"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dockings-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["registered-boats-report"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["boat-types-report"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["owner-info-report"], refetchType: "active" }),
      ]);
    } catch (err) {
      showToast("error", "Failed to Update", err.response?.data?.message ?? "Failed to update owner.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isHeadViewOnly) return;
    if (isTransactionLocked) { showToast("error", "Transactions Locked", transactionLockMessage); return; }
    setSaving(true);
    const fullName = BO_getFullName(deleteOwner);
    try {
      await api.patch(`/boat-owners/${deleteOwner.owner_id}/archive`);
      setOwners((prev) => prev.filter((o) => o.owner_id !== deleteOwner.owner_id));
      queryClient.setQueryData(["boat-owners"], (prev = []) =>
        prev.filter((o) => o.owner_id !== deleteOwner.owner_id)
      );
      archiveOwnerInDataCache(queryClient, deleteOwner.owner_id);
      setDeleteOwner(null);
      showToast("success", "Owner Archived", `"${fullName}" has been archived successfully.`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["boat-owners"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["registered-boats-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["archives-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dockings-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["registered-boats-report"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["boat-types-report"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["owner-info-report"], refetchType: "active" }),
      ]);
    } catch (err) {
      showToast("error", "Archive Failed", err.response?.data?.message ?? "Failed to archive owner.");
    } finally {
      setSaving(false);
    }
  };

  const openOwnerDetails = (owner) => {
    setSelectedOwner(owner);
    setDrawerOpen(true);
  };

  const openEditDrawer = (owner) => {
    setDrawerOpen(false);
    setSelectedOwner(owner);
    setEditOwner(owner);
  };

  const paginated = owners;
  const ownersMeta = boatOwnersQuery.data?.ownersMeta ?? BM_buildLocalMeta(owners, currentPage, BO_PAGE_SIZE);
  const totalPages = Math.max(1, Number(ownersMeta.last_page || 1));
  const safePage = Math.min(requestedPage, totalPages);
  const overviewLoading = boatOwnersQuery.isLoading && !boatOwnersQuery.data;
  const overviewStats = BO_buildOverviewStats(boatOwnersQuery.data?.owners ?? [], boatOwnersQuery.data?.stats);

  useEffect(() => {
    setRequestedPage(1);
    setCurrentPage(1);
  }, [debouncedSearch, ownerStatusFilter]);

  useEffect(() => {
    if (requestedPage > totalPages) {
      setRequestedPage(totalPages);
      setCurrentPage(totalPages);
      return;
    }

    if (requestedPage === currentPage) return undefined;

    const timeout = window.setTimeout(() => {
      setCurrentPage(requestedPage);
    }, 140);

    return () => window.clearTimeout(timeout);
  }, [currentPage, requestedPage, totalPages]);

  return (
    <>
      <style>{`
        * { font-family: ${BO_FONT} !important; }
        input::placeholder { color: #1a1f36 !important; opacity: 0.4; }
        .universal-modal-shell input::placeholder,
        .universal-modal-shell textarea::placeholder,
        .universal-modal-shell .ant-select-selection-placeholder,
        .universal-modal-shell .ant-picker-input > input::placeholder {
          color: #94a3b8 !important;
          opacity: 1 !important;
          font-weight: 400 !important;
        }
      `}</style>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#ffffff" }}>
        <Sidebar activeItem={activeItem} setActiveItem={setActiveItem} open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} onWidthChange={handleWidthChange} />

        <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden"
          style={{ marginLeft: sidebarOpen && window.innerWidth >= 900 ? `${contentMargin}px` : "0px" }}>
          <Topbar sidebarOpen={sidebarOpen} sidebarCollapsed={sidebarCollapsed} onMenuToggle={toggleSidebar} />

          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6 xl:px-8" style={{ backgroundColor: "#ffffff" }}>
            <div className="mx-auto w-full max-w-[1440px]">

            {/* Page Header */}
            <BM_Header
              title="Boat Owners"
              subtitle="View owner details and their registered boats."
              fontFamily={BO_FONT}
              loading={overviewLoading}
            />

            <BM_OverviewGrid stats={overviewStats} loading={overviewLoading} columns={3} />

            <Tabs
              tabs={[{ key: "records", label: "Boat Owners", icon: IoPeopleOutline }]}
              activeKey="records"
              fontFamily={BO_FONT}
              className="mb-5"
              loading={overviewLoading}
            >
            <TableCard
              title="Boat Owner Records"
              subtitle="All registered boat owners in the system"
              loading={overviewLoading}
              headerActionsSkeletonCount={isHeadViewOnly ? 2 : 3}
              pagination={{
                meta: ownersMeta,
                total: ownersMeta.total,
                totalPages,
                currentPage: safePage,
                requestedPage,
                isLoading: fetching,
                onPageChange: setRequestedPage,
                beforePageChange: clearUniversalHighlight,
              }}
              bodyClassName="overflow-x-auto"
              footerClassName="flex items-center justify-between"
              actions={
                <>
                  <div className="flex items-center gap-2.5 px-4 rounded-lg border border-gray-200 bg-white transition-all"
                    style={{ height: 42, width: 280 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = BO_FOCUS_COLOR; e.currentTarget.style.boxShadow = BO_FOCUS_SHADOW; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "#e5e7eb";   e.currentTarget.style.boxShadow = "none"; }}>
                    <IoSearchOutline className="text-[17px] flex-shrink-0" style={{ color: "#1a1f36" }} />
                    <input type="text" placeholder="Search for owner name" value={search}
                      onChange={(e) => { clearUniversalHighlight(); setSearch(e.target.value); setRequestedPage(1); setCurrentPage(1); }}
                      className="bg-transparent border-none outline-none text-[13px] w-full"
                      style={{ fontFamily: BO_FONT, color: "#1a1f36" }} />
                  </div>
                  <BO_TailDropdown
                    value={ownerStatusFilter}
                    onChange={(value) => {
                      clearUniversalHighlight();
                      setOwnerStatusFilter(value);
                      setRequestedPage(1);
                      setCurrentPage(1);
                    }}
                    options={BO_OWNER_STATUS_OPTIONS}
                    height={42}
                  />
                  {!isHeadViewOnly ? (
                    <button
                      onClick={() => { clearUniversalHighlight(); if (!isTransactionLocked) setAddModal(true); else showToast("error", "Transactions Locked", transactionLockMessage); }}
                      disabled={isTransactionLocked}
                      className="ml-1 flex items-center gap-1.5 px-4 py-2 rounded-lg border-none bg-[#1a1f36] cursor-pointer text-[13px] font-semibold text-white hover:bg-[#2d3561] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                      style={{ fontFamily: BO_FONT, height: 42 }}
                    >
                      <IoAddOutline className="text-[17px]" /> Add Owner
                    </button>
                  ) : null}
                </>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 720 }}>
                  <colgroup>
                    <col style={{ width: "24%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "22%" }} />
                    {!isHeadViewOnly ? <col style={{ width: "14%" }} /> : null}
                    <col style={{ width: "14%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <BO_TH>Owner Name</BO_TH>
                      <BO_TH>Address</BO_TH>
                      <BO_TH>Contact</BO_TH>
                      <BO_TH>Usage Count</BO_TH>
                      {!isHeadViewOnly ? <BO_TH>Action</BO_TH> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {fetching ? (
                      Array.from({ length: BO_PAGE_SIZE }).map((_, i) => (
                        <tr key={i} className="animate-pulse" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-32" /></td>
                          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-36" /></td>
                          <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-16" /></td>
                          {!isHeadViewOnly ? <td className="px-4 py-3"><div className="flex gap-2"><div className="w-8 h-8 rounded-lg bg-slate-100" /><div className="w-8 h-8 rounded-lg bg-slate-100" /></div></td> : null}
                        </tr>
                      ))
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={isHeadViewOnly ? 4 : 5}>
                          <NoDataFound title={search || ownerStatusFilter !== "all" ? "No results found" : "No Data Found"} />
                        </td>
                      </tr>
                    ) : (
                      paginated.map((owner, index) => {
                        const fullName = BO_getFullName(owner);
                        const usageCount = BO_getUsageCount(owner);
                        const isArchivedOwner = Boolean(owner?.deleted_at);
                        const isHighlighted =
                          highlightedOwnerId &&
                          String(highlightedOwnerId) === String(owner.owner_id);
                          return (
                          <tr
                            key={owner.owner_id}
                            className={`cursor-pointer transition-colors ${isHighlighted ? "universal-search-highlight" : ""}`.trim()}
                            onClick={() => openOwnerDetails(owner)}
                            style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: highlightedSearchResult ? "#ffffff" : index % 2 === 0 ? "#ffffff" : "#ededed" }}
                          >
                          <td className="px-4 py-3 text-[13px]" style={{ color: "#1a1f36" }}>
                            <p className="m-0 text-[13px] font-normal" style={{ color: "#1a1f36" }}>{fullName}</p>
                          </td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: "#1a1f36" }}>
                              {owner.address}
                          </td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: "#1a1f36" }}>
                              {owner.contact_number ?? "-"}
                          </td>
                            <td className="px-4 py-3 text-[13px]">
                              <button
                                type="button"
                                disabled={usageCount === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (usageCount === 0) return;
                                  navigate(`/registered-boats?ownerId=${owner.owner_id}`);
                                }}
                                className="border-none bg-transparent p-0"
                                style={{ cursor: usageCount > 0 ? "pointer" : "default" }}
                                title={usageCount > 0 ? "View registered boats using this owner" : undefined}
                              >
                                <StatusPill
                                  status={usageCount > 0 ? "enabled" : "disabled"}
                                  label={BO_getUsageCountLabel(owner)}
                                />
                              </button>
                            </td>
                            {!isHeadViewOnly ? (
                              <td className="px-4 py-3 text-[13px]">
                                <div className="flex items-center gap-2">
                                  <Tooltip title={isTransactionLocked ? transactionLockMessage : "Edit"}>
                                    <button onClick={(e) => { e.stopPropagation(); if (!isTransactionLocked) openEditDrawer(owner); else showToast("error", "Transactions Locked", transactionLockMessage); }}
                                      disabled={isTransactionLocked}
                                      className="w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer bg-white hover:bg-blue-50 transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-60"
                                      style={{ borderColor: isTransactionLocked ? undefined : "#1a1f36" }}>
                                      <IoCreateOutline style={{ fontSize: "15px", color: isTransactionLocked ? "#94a3b8" : "#1a1f36" }} />
                                    </button>
                                  </Tooltip>
                                  <Tooltip
                                    title={
                                      isTransactionLocked
                                        ? transactionLockMessage
                                        : isArchivedOwner
                                          ? "Already archived"
                                          : "Archive"
                                    }
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isTransactionLocked || isArchivedOwner) return;
                                        setDeleteOwner(owner);
                                      }}
                                      disabled={isTransactionLocked || isArchivedOwner}
                                      className={`w-8 h-8 rounded-lg border flex items-center justify-center bg-white transition-colors ${
                                        isTransactionLocked || isArchivedOwner
                                          ? "cursor-not-allowed border-slate-200"
                                          : "cursor-pointer border-red-300 hover:bg-red-50"
                                      }`}
                                    >
                                      <IoArchiveOutline
                                        style={{
                                          fontSize: "15px",
                                          color: isTransactionLocked || isArchivedOwner ? "#94a3b8" : "#ef4444",
                                        }}
                                      />
                                    </button>
                                  </Tooltip>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </TableCard>
            </Tabs>
            </div>
          </main>
        </div>
      </div>

      {!isHeadViewOnly ? <BO_OwnerDrawer
        open={addModal}
        onClose={() => setAddModal(false)}
        onSave={handleAdd}
        saving={saving}
        owners={owners}
      /> : null}

      {!isHeadViewOnly ? <BO_OwnerDrawer
        owner={editOwner}
        open={!!editOwner}
        onClose={() => setEditOwner(null)}
        onNoChanges={() => {
          setEditOwner(null);
          showToast("info", "No Changes Made", "No changes were made. The record remains the same.");
        }}
        onSave={handleEdit}
        saving={saving}
        owners={owners}
      /> : null}

      {/* Archive Confirmation Modal */}
      {!isHeadViewOnly && deleteOwner && (
        <ArchiveModal
          open={!!deleteOwner}
          title="Archive Owner"
          itemName={BO_getFullName(deleteOwner)}
          onClose={() => setDeleteOwner(null)}
          onConfirm={handleDelete}
          saving={saving}
          fontFamily={BO_FONT}
        />
      )}

      <BO_OwnerDetailsDrawer
        owner={selectedOwner}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default BO_BoatOwners;
