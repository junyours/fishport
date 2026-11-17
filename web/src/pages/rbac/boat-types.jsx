import { useState, useEffect, useRef, useCallback } from "react";
import { Drawer as AntDrawer, Tooltip } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import "typeface-montserrat";
import {
  IoAddOutline,
  IoCalendarOutline,
  IoCloseOutline,
  IoLayersOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoArchiveOutline,
  IoCheckmarkOutline,
  IoAlertCircleOutline,
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
import { useBoatTypesQuery } from "../../hooks/useBoatManagement";
import { useTransactionLockQuery } from "../../hooks/useTransactionLockQuery";
import { addBoatTypeToDataCache, archiveBoatTypeInDataCache, updateBoatTypeInDataCache } from "../../utils/boatManagementCache";
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

const BT_buildOverviewStats = (boatTypes = [], stats = {}) => [
  {
    label: "Total Boat Type",
    value: stats.total_types ?? boatTypes.length,
    icon: IoLayersOutline,
    tone: "blue",
  },
  {
    label: "Boat Type in Use",
    value: stats.boat_types_in_use ?? boatTypes.filter((type) => Number(type?.boats_count ?? 0) > 0).length,
    icon: IoCheckmarkOutline,
    tone: "green",
  },
  {
    label: "Boat Type Not in Use",
    value: stats.boat_types_not_in_use ?? boatTypes.filter((type) => Number(type?.boats_count ?? 0) === 0).length,
    icon: IoCloseOutline,
    tone: "amber",
  },
];

const BT_FONT         = "'Montserrat', sans-serif";

const BT_PAGE_SIZE    = 10;

const BT_FOCUS_COLOR  = "#4096ff";

const BT_FOCUS_SHADOW = "none";

const BT_BOAT_TYPE_STATUS_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "used", label: "Used" },
  { value: "unused", label: "Unused" },
];

const BT_formatDate = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
};

const BT_Spinner = Spinner;

const BT_BoatTypeModal = ({ title, typeName, setTypeName, onClose, onSave, saving, error, saveLabel = "Add" }) => (
  <Modal
    title={title}
    onClose={onClose}
    onSave={onSave}
    saving={saving}
    saveLabel={saveLabel}
    maxWidth="520px"
    closeOnBackdrop
  >
    <ModalTextInput
      label={
        <>
          Type Name <span className="text-red-500">*</span>
        </>
      }
      autoFocus
      value={typeName}
      onChange={(e) => setTypeName(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
      placeholder="Enter boat type name"
      icon={IoLayersOutline}
      error={error}
      inputStyle={{ fontFamily: BT_FONT }}
    />
  </Modal>
);

const BT_TailDropdown = ({ value, onChange, options, height = 38 }) => (
  <FilterButton value={value} onChange={onChange} options={options} height={height} width={160} />
);

const BT_BoatTypeDrawer = ({ open, title, subtitle, typeName, setTypeName, onClose, onSave, saving, error, saveLabel }) => (
  <AntDrawer
    open={open}
    onClose={onClose}
    width={500}
    closable={false}
    styles={{
      body: { padding: 0, fontFamily: BT_FONT, backgroundColor: "#f8fafc" },
      header: { display: "none" },
      footer: { padding: "16px 24px", borderTop: "1px solid #e5e7eb", backgroundColor: "#ffffff" },
    }}
    footer={
      <div className="flex justify-end gap-3">
        <button onClick={onClose} disabled={saving}
          className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
          style={{ fontFamily: BT_FONT, color: "#1a1f36", opacity: saving ? 0.5 : 1 }}>
          Cancel
        </button>
        <button onClick={onSave} disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold cursor-pointer transition-colors"
          style={{ fontFamily: BT_FONT, backgroundColor: saving ? "#6b7280" : "#1a1f36", border: "none", minWidth: 108 }}
          onMouseEnter={(e) => { if (!saving) e.currentTarget.style.backgroundColor = "#2d3561"; }}
          onMouseLeave={(e) => { if (!saving) e.currentTarget.style.backgroundColor = "#1a1f36"; }}>
          {saving && <BT_Spinner size={4} />}
          {saving ? "" : saveLabel}
        </button>
      </div>
    }
  >
    <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: "#1a1f36" }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <IoLayersOutline className="text-white text-[18px]" />
        </div>
        <div>
          <p className="m-0 text-[15px] font-bold text-white">{title}</p>
          <p className="m-0 text-[11px] text-white/50">{subtitle}</p>
        </div>
      </div>
      <button onClick={onClose}
        className="flex items-center justify-center border-none cursor-pointer transition-colors"
        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"}
      >
        <IoCloseOutline style={{ fontSize: 17 }} />
      </button>
    </div>
    <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
      <div className="bg-white rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <IoLayersOutline className="text-blue-500 text-[16px]" />
          </div>
          <div>
            <p className="m-0 text-[13px] font-bold" style={{ color: "#1a1f36", fontFamily: BT_FONT }}>Boat Type Information</p>
            <p className="m-0 text-[11px] text-slate-500" style={{ fontFamily: BT_FONT }}>{subtitle}</p>
          </div>
        </div>
        <div className="p-5">
          <p
            className="m-0 mb-2 text-[11px] font-semibold uppercase"
            style={{ color: "#6F6F82", fontFamily: BT_FONT }}
          >
            Type Name <span className="text-red-500">*</span>
          </p>
          <div
            className="flex items-center gap-3 px-4 rounded-xl border border-slate-200 bg-white transition-all"
            style={{ height: 46 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = BT_FOCUS_COLOR; e.currentTarget.style.boxShadow = BT_FOCUS_SHADOW; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "#e2e8f0";   e.currentTarget.style.boxShadow = "none"; }}
          >
            <IoLayersOutline className="text-slate-400 text-[16px] flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
              placeholder="e.g. Fishing Vessel"
              className="border-none outline-none text-[14px] font-medium w-full bg-transparent"
              style={{ fontFamily: BT_FONT, color: "#0d1117" }}
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 mt-3">
              <IoAlertCircleOutline className="text-red-400 text-[14px] flex-shrink-0" />
              <p className="m-0 text-[12px] font-normal text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </AntDrawer>
);

const BT_BoatTypeDetailsDrawer = ({ boatType, open, onClose }) => {
  if (!boatType) return null;
  const navigate = useNavigate();

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      width={460}
      fontFamily={BT_FONT}
      title="Boat Type Details"
      subtitle="Review the selected boat type record."
      icon={IoLayersOutline}
    >
      <DrawerSection
        icon={IoLayersOutline}
        title="Boat Type Info"
        subtitle="Registered details for this boat type"
        fontFamily={BT_FONT}
      >
        <div className="grid grid-cols-1 gap-3">
          <DrawerInfoCard label="Type Name" value={boatType.type_name ?? "-"} />
          <DrawerInfoCard
            label="Usage Count"
            value={
              <button
                type="button"
                onClick={() => navigate(`/registered-boats?boatTypeId=${boatType.boat_type_id}`)}
                className="border-none bg-transparent p-0 text-[13px] font-semibold cursor-pointer hover:underline"
                style={{ fontFamily: BT_FONT, color: "#1a1f36" }}
              >
                {`${boatType.boats_count ?? 0} ${(boatType.boats_count ?? 0) <= 1 ? "count" : "counts"}`}
              </button>
            }
          />
        </div>
      </DrawerSection>
      <DrawerSection
        icon={IoCalendarOutline}
        title="Created Details"
        subtitle="Record creation information"
        fontFamily={BT_FONT}
      >
        <div className="grid grid-cols-1 gap-3">
          <DrawerInfoCard label="Created By" value={RB_getCreatedByLabel(boatType)} />
          <DrawerInfoCard label="Date Added" value={BT_formatDate(boatType.created_at)} />
        </div>
      </DrawerSection>
    </DetailDrawer>
  );
};

const BT_TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap"
    style={{ color: "#1a1f36", backgroundColor: "#ffffff", borderBottom: "2px solid #e5e7eb" }}>
    {children}
  </th>
);

const BT_SuperAddBoatType = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const highlightedSearchResult = location.state?.universalSearchResult ?? null;
  const cachedRegisteredBoatsData = queryClient.getQueriesData({ queryKey: ["registered-boats-data"] })
    .find(([, data]) => data?.boatTypes)?.[1];
  const [activeItem,    setActiveItem]    = useState("Boat Management");
  const [contentMargin, setContentMargin] = useState(() => window.innerWidth >= 900 ? 256 : 0);
  const [boatTypes,     setBoatTypes]     = useState(() => cachedRegisteredBoatsData?.boatTypes ?? []);
  const [search,        setSearch]        = useState("");
  const [typeStatusFilter, setTypeStatusFilter] = useState("all");
  const [requestedPage, setRequestedPage] = useState(1);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const { isTransactionLocked, transactionLockMessage } = useTransactionLockQuery("boat-management");
  const isHeadViewOnly = isHeadRole();
  const [editTarget,    setEditTarget]    = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [selectedType,  setSelectedType]  = useState(null);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [fetching,      setFetching]      = useState(() => !cachedRegisteredBoatsData?.boatTypes);
  const urlFiltersKeyRef = useRef(null);

  const [addName,   setAddName]   = useState("");
  const [addError,  setAddError]  = useState("");
  const [editName,  setEditName]  = useState("");
  const [editError, setEditError] = useState("");

  const debouncedSearch = BM_useDebouncedValue(search);
  const rawHighlightedBoatTypeId = BM_getHighlightId({
    highlightedSearchResult,
    group: "Boat Type",
    prefix: "boat-type-",
    search: location.search,
  });
  const highlightToken = rawHighlightedBoatTypeId
    ? `${rawHighlightedBoatTypeId}|${location.search}|${highlightedSearchResult?.group || ""}`
    : "";
  const [dismissedHighlightToken, setDismissedHighlightToken] = useState("");
  const highlightedBoatTypeId = dismissedHighlightToken === highlightToken ? "" : rawHighlightedBoatTypeId;
  const clearUniversalHighlight = useCallback(() => {
    if (highlightToken) {
      setDismissedHighlightToken(highlightToken);
    }
    BM_clearUniversalHighlight({ highlightedSearchResult, location, navigate });
  }, [highlightToken, highlightedSearchResult, location, navigate]);
  useEffect(() => {
    setDismissedHighlightToken("");
  }, [location.key]);
  const boatTypesQuery = useBoatTypesQuery(
    {
      page: currentPage,
      perPage: BT_PAGE_SIZE,
      search: debouncedSearch,
      usage: typeStatusFilter,
      highlightBoatTypeId: highlightedBoatTypeId,
    }
  );
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleSidebar } = useSidebar();
  const handleWidthChange = useCallback((w) => setContentMargin(w), []);

  useEffect(() => {
    setFetching(boatTypesQuery.isLoading && boatTypes.length === 0);
  }, [boatTypes.length, boatTypesQuery.isLoading]);

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
    if (boatTypesQuery.data) {
      setBoatTypes(boatTypesQuery.data.boatTypes);
    }
  }, [boatTypesQuery.data]);

  useEffect(() => {
    if (!highlightedBoatTypeId) return;
    const resolvedPage = Number(boatTypesQuery.data?.boatTypesMeta?.current_page || 0);
    if (resolvedPage > 0 && (resolvedPage !== currentPage || resolvedPage !== requestedPage)) {
      setRequestedPage(resolvedPage);
      setCurrentPage(resolvedPage);
    }
  }, [currentPage, highlightedBoatTypeId, boatTypesQuery.data?.boatTypesMeta?.current_page, requestedPage]);

  useEffect(() => {
    if (boatTypesQuery.isError) {
      showToast("error", "Error", "Failed to load boat types.");
    }
  }, [boatTypesQuery.isError]);

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

  const handleAdd = async () => {
    if (isHeadViewOnly) return;
    if (isTransactionLocked) { showToast("error", "Transactions Locked", transactionLockMessage); return; }
    if (!addName.trim()) { setAddError("Boat type name is required."); return; }
    setLoading(true);
    try {
      const res = await api.post("/boat-types", { type_name: addName.trim() });
      setBoatTypes((prev) => [res.data, ...prev]);
      queryClient.setQueryData(["boat-types"], (prev = []) => [res.data, ...prev]);
      addBoatTypeToDataCache(queryClient, res.data);
      setShowAddModal(false);
      setAddName("");
      setAddError("");
      showAddedToast("Boat Type", "boat type");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["boat-types"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dockings-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["registered-boats-report"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["boat-types-report"], refetchType: "active" }),
      ]);
    } catch (err) {
      setAddError(err.response?.data?.message ?? "Failed to add boat type.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (isHeadViewOnly) return;
    if (isTransactionLocked) { showToast("error", "Transactions Locked", transactionLockMessage); return; }
    if (!editName.trim()) { setEditError("Boat type name is required."); return; }

    // No-changes detection
    if (editName.trim() === editTarget.type_name.trim()) {
      setEditTarget(null);
      showToast("info", "No Changes Made", "No changes were made. The record remains the same.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.put(`/boat-types/${editTarget.boat_type_id}`, { type_name: editName.trim() });
      setBoatTypes((prev) => prev.map((t) => t.boat_type_id === editTarget.boat_type_id ? res.data : t));
      setSelectedType((prev) => (prev?.boat_type_id === editTarget.boat_type_id ? res.data : prev));
      queryClient.setQueryData(["boat-types"], (prev = []) =>
        prev.map((t) => (t.boat_type_id === editTarget.boat_type_id ? res.data : t))
      );
      updateBoatTypeInDataCache(queryClient, res.data);
      setEditTarget(null);
      setEditName("");
      setEditError("");
      showUpdatedToast("Boat Type", "boat type");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["boat-types"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dockings-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["registered-boats-report"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["boat-types-report"], refetchType: "active" }),
      ]);
    } catch (err) {
      setEditError(err.response?.data?.message ?? "Failed to update boat type.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isHeadViewOnly) return;
    if (isTransactionLocked) { showToast("error", "Transactions Locked", transactionLockMessage); return; }
    const { boat_type_id, type_name } = deleteTarget;
    try {
      await api.patch(`/boat-types/${boat_type_id}/archive`);
      setBoatTypes((prev) => prev.filter((t) => t.boat_type_id !== boat_type_id));
      queryClient.setQueryData(["boat-types"], (prev = []) => prev.filter((t) => t.boat_type_id !== boat_type_id));
      archiveBoatTypeInDataCache(queryClient, boat_type_id);
      setDeleteTarget(null);
      showToast("success", "Boat Type Archived", `"${type_name}" has been archived successfully.`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["boat-types"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["registered-boats-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["archives-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dockings-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["registered-boats-report"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["boat-types-report"], refetchType: "active" }),
      ]);
    } catch (err) {
      showToast("error", "Archive Failed", err.response?.data?.message ?? "Failed to archive boat type.");
      throw err;
    }
  };

  const openEdit = (type) => {
    setDrawerOpen(false);
    setSelectedType(type);
    setEditTarget(type);
    setEditName(type.type_name);
    setEditError("");
  };

  const openTypeDetails = (type) => {
    setSelectedType(type);
    setDrawerOpen(true);
  };

  const paginated = boatTypes;
  const boatTypesMeta = boatTypesQuery.data?.boatTypesMeta ?? BM_buildLocalMeta(boatTypes, currentPage, BT_PAGE_SIZE);
  const totalPages = Math.max(1, Number(boatTypesMeta.last_page || 1));
  const safePage = Math.min(requestedPage, totalPages);
  const overviewLoading = boatTypesQuery.isLoading && !boatTypesQuery.data;
  const overviewStats = BT_buildOverviewStats(boatTypesQuery.data?.boatTypes ?? [], boatTypesQuery.data?.stats);

  useEffect(() => {
    setRequestedPage(1);
    setCurrentPage(1);
  }, [debouncedSearch, typeStatusFilter]);

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
      <style>{`* { font-family: ${BT_FONT} !important; } input::placeholder { color: #1a1f36 !important; opacity: 0.4; }`}</style>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#ffffff" }}>
        <Sidebar activeItem={activeItem} setActiveItem={setActiveItem} open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} onWidthChange={handleWidthChange} />

        <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden"
          style={{ marginLeft: sidebarOpen && window.innerWidth >= 900 ? `${contentMargin}px` : "0px" }}>
          <Topbar sidebarOpen={sidebarOpen} sidebarCollapsed={sidebarCollapsed} onMenuToggle={toggleSidebar} />

          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6 xl:px-8" style={{ backgroundColor: "#ffffff" }}>
            <div className="mx-auto w-full max-w-[1440px]">

            <BM_Header
              title="Boat Types"
              subtitle="View the boat types used in port records."
              fontFamily={BT_FONT}
              loading={overviewLoading}
            />

            <BM_OverviewGrid stats={overviewStats} loading={overviewLoading} columns={3} />

            <Tabs
              tabs={[{ key: "records", label: "Boat Types", icon: IoLayersOutline }]}
              activeKey="records"
              fontFamily={BT_FONT}
              className="mb-5"
              loading={overviewLoading}
            >
            <TableCard
              title="Boat Type Records"
              subtitle="All registered boat types in the system"
              loading={overviewLoading}
              headerActionsSkeletonCount={isHeadViewOnly ? 2 : 3}
              pagination={{
                meta: boatTypesMeta,
                total: boatTypesMeta.total,
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
                  <div
                    className="flex items-center gap-2.5 px-4 rounded-lg border border-gray-200 bg-white transition-all"
                    style={{ height: 42, width: 280 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = BT_FOCUS_COLOR; e.currentTarget.style.boxShadow = BT_FOCUS_SHADOW; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "#e5e7eb";   e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <IoSearchOutline className="text-[17px] flex-shrink-0" style={{ color: "#1a1f36" }} />
                    <input type="text" placeholder="Search for type name" value={search}
                      onChange={(e) => { clearUniversalHighlight(); setSearch(e.target.value); setRequestedPage(1); setCurrentPage(1); }}
                      className="bg-transparent border-none outline-none text-[13px] w-full"
                      style={{ fontFamily: BT_FONT, color: "#1a1f36" }} />
                  </div>
                  <BT_TailDropdown
                    value={typeStatusFilter}
                    onChange={(value) => {
                      clearUniversalHighlight();
                      setTypeStatusFilter(value);
                      setRequestedPage(1);
                      setCurrentPage(1);
                    }}
                    options={BT_BOAT_TYPE_STATUS_OPTIONS}
                    height={42}
                  />
                  {!isHeadViewOnly ? (
                    <button
                      onClick={() => { clearUniversalHighlight(); if (!isTransactionLocked) { setAddName(""); setAddError(""); setShowAddModal(true); } else showToast("error", "Transactions Locked", transactionLockMessage); }}
                      disabled={isTransactionLocked}
                      className="ml-1 flex items-center gap-1.5 px-4 py-2 rounded-lg border-none bg-[#1a1f36] cursor-pointer text-[13px] font-semibold text-white hover:bg-[#2d3561] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                      style={{ fontFamily: BT_FONT, height: 42 }}
                    >
                      <IoAddOutline className="text-[17px]" /> Add Boat Type
                    </button>
                  ) : null}
                </>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: isHeadViewOnly ? 440 : 540 }}>
                  <colgroup>
                    <col style={{ width: isHeadViewOnly ? "68%" : "56%" }} />
                    <col style={{ width: isHeadViewOnly ? "32%" : "24%" }} />
                    {!isHeadViewOnly ? <col style={{ width: "20%" }} /> : null}
                  </colgroup>
                  <thead>
                    <tr>
                      <BT_TH>Type Name</BT_TH>
                      <BT_TH><div className="text-center">Usage Count</div></BT_TH>
                      {!isHeadViewOnly ? <BT_TH>Action</BT_TH> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {fetching ? (
                      Array.from({ length: BT_PAGE_SIZE }).map((_, i) => (
                        <tr key={i} className="animate-pulse" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-32" /></td>
                          <td className="px-4 py-3"><div className="mx-auto h-5 w-16 rounded bg-slate-100" /></td>
                          {!isHeadViewOnly ? <td className="px-4 py-3"><div className="flex gap-2"><div className="w-8 h-8 rounded-lg bg-slate-100" /><div className="w-8 h-8 rounded-lg bg-slate-100" /></div></td> : null}
                        </tr>
                      ))
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={isHeadViewOnly ? 2 : 3}>
                          <NoDataFound title={search || typeStatusFilter !== "all" ? "No results found" : "No Data Found"} />
                        </td>
                      </tr>
                    ) : (
                        paginated.map((type, index) => {
                          const isHighlighted =
                            highlightedBoatTypeId &&
                            String(highlightedBoatTypeId) === String(type.boat_type_id);
                          return (
                        <tr key={type.boat_type_id} className={`cursor-pointer transition-colors ${isHighlighted ? "universal-search-highlight" : ""}`.trim()} onClick={() => openTypeDetails(type)} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: highlightedSearchResult ? "#ffffff" : index % 2 === 0 ? "#ffffff" : "#ededed" }}>
                          <td className="px-4 py-3 text-[13px]" style={{ color: "#1a1f36" }}>
                            <p className="m-0 text-[13px] font-normal" style={{ color: "#1a1f36" }}>{type.type_name}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-[13px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                navigate(`/registered-boats?boatTypeId=${type.boat_type_id}`);
                              }}
                              className="border-none bg-transparent p-0 cursor-pointer"
                            >
                              <StatusPill
                                status={(type.boats_count ?? 0) > 0 ? "enabled" : "disabled"}
                                label={`${type.boats_count ?? 0} ${(type.boats_count ?? 0) <= 1 ? "count" : "counts"}`}
                              />
                            </button>
                          </td>
                          {!isHeadViewOnly ? (
                            <td className="px-4 py-3 text-[13px]">
                              <div className="flex items-center gap-2">
                                <Tooltip title={isTransactionLocked ? transactionLockMessage : "Edit"}>
                                  <button onClick={(e) => { e.stopPropagation(); if (!isTransactionLocked) openEdit(type); else showToast("error", "Transactions Locked", transactionLockMessage); }}
                                    disabled={isTransactionLocked}
                                    className="w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer bg-white hover:bg-blue-50 transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-60"
                                    style={{ borderColor: isTransactionLocked ? undefined : "#1a1f36" }}>
                                    <IoCreateOutline style={{ fontSize: "15px", color: isTransactionLocked ? "#94a3b8" : "#1a1f36" }} />
                                  </button>
                                </Tooltip>
                                <Tooltip title={isTransactionLocked ? transactionLockMessage : "Archive"}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isTransactionLocked) return;
                                      setDeleteTarget(type);
                                    }}
                                    disabled={isTransactionLocked}
                                    className={`w-8 h-8 rounded-lg border flex items-center justify-center bg-white transition-colors ${
                                      isTransactionLocked
                                        ? "cursor-not-allowed border-slate-200"
                                        : "cursor-pointer border-red-300 hover:bg-red-50"
                                    }`}
                                  >
                                    <IoArchiveOutline
                                      style={{
                                        fontSize: "15px",
                                        color: isTransactionLocked ? "#94a3b8" : "#ef4444",
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

      {!isHeadViewOnly && showAddModal && (
        <BT_BoatTypeModal
          title="Add Boat Type"
          subtitle="Register a new boat type"
          typeName={addName}
          setTypeName={(v) => { setAddName(v); setAddError(""); }}
          onClose={() => setShowAddModal(false)}
          onSave={handleAdd}
          saving={loading}
          error={addError}
          saveLabel="Add"
        />
      )}

      {!isHeadViewOnly && editTarget && (
        <BT_BoatTypeModal
          title="Edit Boat Type"
          subtitle="Update the selected boat type"
          typeName={editName}
          setTypeName={(v) => { setEditName(v); setEditError(""); }}
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
          saving={loading}
          error={editError}
          saveLabel="Save"
        />
      )}

      <BT_BoatTypeDetailsDrawer
        boatType={selectedType}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {!isHeadViewOnly ? <ArchiveModal
        open={!!deleteTarget}
        title="Archive Boat Type"
        itemName={deleteTarget?.type_name ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        fontFamily={BT_FONT}
      /> : null}
    </>
  );
};

export default BT_SuperAddBoatType;
