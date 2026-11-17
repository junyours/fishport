import React, { useState, useEffect, useRef, useCallback } from "react";
import { ConfigProvider, Drawer as AntDrawer, Tooltip } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { getVisitingBoatRegistrationData } from "../../lib/frequentVisitRegistration";
import "typeface-montserrat";
import {
  IoAddOutline,
  IoPersonOutline,
  IoLocationOutline,
  IoCalendarOutline,
  IoCallOutline,
  IoDocumentTextOutline,
  IoCloseOutline,
  IoLayersOutline,
  IoBoatOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoArchiveOutline,
  IoCheckmarkOutline,
  IoImageOutline,
  IoCloudUploadOutline,
  IoExpandOutline,
  IoAlertCircleOutline,
  IoWarningOutline,
} from "react-icons/io5";
import Sidebar from "../../layout/Sidebar";
import Topbar from "../../layout/Topbar";
import StatusPill from "../../components/StatusPill";
import DetailDrawer, { DrawerInfoCard, DrawerSection } from "../../components/Drawer";
import FilterSelect from "../../components/FilterSelect";
import FilterButton from "../../components/FilterButton";
import Legend from "../../components/Legend";
import Modal from "../../components/Modal";
import Card from "../../components/Card";
import TableCard from "../../components/TableCard";
import Tabs from "../../components/Tabs";
import Spinner from "../../components/Spinner";
import NoDataFound from "../../components/NoDataFound";
import ArchiveModal from "../../components/ArchiveModal";
import { showAddedToast, showBottomToast, showNoChangesToast, showUpdatedToast } from "../../store/bottomToastStore";
import { useSidebar } from "../../store/sidebarStore";
import api from "../../api/axios";
import { useRegisteredBoatsDataQuery } from "../../hooks/useBoatManagement";
import { useTransactionLockQuery } from "../../hooks/useTransactionLockQuery";
import { addRegisteredBoatToDataCache, archiveRegisteredBoatInDataCache, updateRegisteredBoatsDataCache } from "../../utils/boatManagementCache";
import { isHeadRole } from "../../utils/transactionLock";
import {
  RB_getCreatedBy,
  RB_getCreatedByLabel,
  BM_getHighlightId,
  BM_clearUniversalHighlight,
  BM_OverviewGrid,
  BM_buildLocalMeta,
  BM_useDebouncedValue,
  BM_Header,
} from "../../features/boat-management/shared";

const RB_PAGE_SIZE = 10;

const RB_FONT = "'Montserrat', sans-serif";

const MAX_BOAT_IMAGE_SIZE_KB = 50000;

const MAX_BOAT_IMAGE_SIZE_BYTES = MAX_BOAT_IMAGE_SIZE_KB * 1024;

const RB_getOwnerName = (owner) =>
  `${owner?.owner_firstname ?? ""} ${owner?.owner_lastname ?? ""}`.trim() || "-";

const RB_getBoatType  = (boat) => boat?.boat_type  ?? boat?.boatType  ?? null;

const RB_getBoatImageSrc = (boat) => {
  const imagePath = String(boat?.image_path ?? "").trim();
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${api.defaults.baseURL.replace("/api", "")}/storage/${imagePath}`;
};

const uploadBoatImageInBackground = ({ queryClient, boat, imageFile, onUploaded }) => {
  if (!boat?.boat_id || !imageFile) return;

  const formData = new FormData();
  formData.append("image", imageFile);

  void api
    .post(`/boats/${boat.boat_id}/upload-image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((response) => {
      const updatedBoat = {
        ...boat,
        image_path: response.data?.image_path ?? boat.image_path,
        image_public_id: response.data?.image_public_id ?? boat.image_public_id,
      };

      updateRegisteredBoatsDataCache(queryClient, updatedBoat);
      onUploaded?.(updatedBoat);
      showBottomToast("success", "Image Uploaded", "Boat image has been saved.");
    })
    .catch((error) => {
      showBottomToast(
        "error",
        "Image Upload Failed",
        error.response?.data?.message ?? "Boat was saved, but the image upload failed."
      );
    });
};

const RB_getOwnerLabel = (owner) =>
  `${owner?.owner_firstname ?? ""} ${owner?.owner_lastname ?? ""}`.trim() || owner?.owner_name || RB_getOwnerName(owner);

const RB_getBoatTypeLabel = (boatType) => boatType?.type_name || "-";

const RB_isArchivedLookup = (item) => Boolean(item?.deleted_at);

const RB_getLookupOptionLabel = (label, item) => (
  <span className="flex items-center gap-2">
    <span>{label}</span>
    {RB_isArchivedLookup(item) ? (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
        Archived
      </span>
    ) : null}
  </span>
);

const RB_statusStyle = (status) => {
  if (status === "active")        return { key: "active", label: "Active" };
  if (status === "expired")       return { key: "expired", label: "Expired" };
  if (status === "suspended")     return { key: "suspended", label: "Suspended" };
  if (status === "under_repair")  return { key: "under_repair", label: "Under Repair" };
  return { key: status, label: status };
};

const RB_formatDate = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
};

const RB_STATUS_OPTIONS = [
  { value: "active",       label: "Active",        activeBorder: "border-emerald-600", activeBg: "bg-emerald-50", activeText: "text-emerald-700" },
  { value: "expired",      label: "Expired",       activeBorder: "border-rose-500",    activeBg: "bg-rose-50",    activeText: "text-rose-700" },
  { value: "suspended",    label: "Suspended",     activeBorder: "border-amber-500",   activeBg: "bg-amber-50",   activeText: "text-amber-700" },
  { value: "under_repair", label: "Under Repair",  activeBorder: "border-violet-500", activeBg: "bg-violet-50", activeText: "text-violet-700" },
];

const RB_STATUS_FILTER_OPTIONS = [
  { value: "all",       label: "All Status" },
  { value: "active",       label: "Active"        },
  { value: "expired",      label: "Expired"       },
  { value: "suspended",    label: "Suspended"     },
  { value: "under_repair", label: "Under Repair"  },
];

const RB_BOAT_STATUS_LEGEND = [
  {
    key: "active",
    label: "Active",
    meaning: "Boat is allowed to Banyera and Docking",
    color: "#16a34a",
  },
  {
    key: "expired",
    label: "Expired",
    meaning: "Not allowed to operate in Banyera",
    color: "#ef4444",
  },
  {
    key: "suspended",
    label: "Suspended",
    meaning: "Not allowed to operate in Banyera",
    color: "#f59e0b",
  },
  {
    key: "under_repair",
    label: "Under Repair",
    meaning: "Not allowed to operate in Banyera",
    color: "#8b5cf6",
  },
];

const RB_getBoatStatusIndicatorColor = (status) =>
  RB_BOAT_STATUS_LEGEND.find((item) => item.key === status)?.color ?? "#94a3b8";

const BM_getBoatStatus = (boat) =>
  String(boat?.status ?? "").trim().toLowerCase().replace(/\s+/g, "_");

const BM_buildOverviewStats = (boats = [], boatTypes = [], owners = []) => [
  {
    label: "Total Registered Boats",
    value: boats.length,
    icon: IoBoatOutline,
    tone: "blue",
  },
  {
    label: "Active Boats",
    value: boats.filter((boat) => BM_getBoatStatus(boat) === "active").length,
    icon: IoCheckmarkOutline,
    tone: "green",
  },
  {
    label: "Expired Boats",
    value: boats.filter((boat) => BM_getBoatStatus(boat) === "expired").length,
    icon: IoAlertCircleOutline,
    tone: "rose",
  },
  {
    label: "Suspended Boats",
    value: boats.filter((boat) => BM_getBoatStatus(boat) === "suspended").length,
    icon: IoCloseOutline,
    tone: "amber",
  },
  {
    label: "Under Repair Boats",
    value: boats.filter((boat) => BM_getBoatStatus(boat) === "under_repair").length,
    icon: IoWarningOutline,
    tone: "violet",
  },
];

const BM_applyOverviewStats = (items = [], stats = {}) =>
  items.map((item) => {
    if (item.label === "Total Registered Boats" && stats.total_registered !== undefined) {
      return { ...item, value: stats.total_registered };
    }
    if (item.label === "Active Boats" && stats.active_boats !== undefined) {
      return { ...item, value: stats.active_boats };
    }
    if (item.label === "Expired Boats" && stats.expired_boats !== undefined) {
      return { ...item, value: stats.expired_boats };
    }
    if (item.label === "Suspended Boats" && stats.suspended_boats !== undefined) {
      return { ...item, value: stats.suspended_boats };
    }
    if (item.label === "Under Repair Boats" && stats.under_repair_boats !== undefined) {
      return { ...item, value: stats.under_repair_boats };
    }

    return item;
  });

const BM_getCachedOverviewData = (queryClient) => {
  const candidate = queryClient
    .getQueriesData({ queryKey: ["registered-boats-data"] })
    .map(([queryKey, data]) => ({ queryKey, data }))
    .filter(({ data }) => data?.stats || Array.isArray(data?.boats));

  const withStats = candidate.find(({ data }) => data?.stats);
  if (withStats) return withStats.data;

  const withCargo = candidate.find(({ queryKey }) => queryKey?.[1]?.includeBoats);
  if (withCargo) return withCargo.data;

  return candidate.length > 0 ? candidate[0].data : undefined;
};

const BM_getOverviewStats = (data, fallback = {}) =>
  BM_applyOverviewStats(
    BM_buildOverviewStats(
      data?.boats ?? fallback.boats ?? [],
      data?.boatTypes ?? fallback.boatTypes ?? [],
      data?.owners ?? fallback.owners ?? []
    ),
    data?.stats
  );

const RB_buildOwnerFilterOptions = (owners) => [
  { value: "all", label: "All Owners" },
  ...owners.map((owner) => ({
    value: String(owner.owner_id),
    label: RB_getOwnerLabel(owner),
  })),
];

const RB_buildBoatTypeFilterOptions = (boatTypes) => [
  { value: "all", label: "All Boat Types" },
  ...boatTypes.map((type) => ({
    value: String(type.boat_type_id),
    label: RB_getBoatTypeLabel(type),
  })),
];

const RB_antTheme = {
  token: { colorPrimary: "#4096ff", borderRadius: 12, fontFamily: RB_FONT, controlHeight: 42, fontSize: 13 },
  components: {
    Select: { optionSelectedBg: "#1a1f36", optionSelectedColor: "#ffffff", optionActiveBg: "#f8fafc", optionFontSize: 13 },
  },
};

const RB_Label = ({ children, required }) => (
  <label
    className="mb-1.5 block text-[11px] font-semibold uppercase"
    style={{ color: "#6F6F82", fontFamily: RB_FONT }}
  >
    {children}
    {required && <span className="ml-0.5 text-red-500">*</span>}
  </label>
);

const RB_FInput = React.forwardRef(({ icon: Icon, placeholder, value, onChange, readOnly }, ref) => (
  <div
    className={`flex items-center gap-2.5 px-3.5 border border-gray-200 transition-all ${readOnly ? "bg-gray-50" : "bg-white"}`}
    style={{ height: 42, borderRadius: 12 }}
    onFocus={(e) => { if (!readOnly) { e.currentTarget.style.borderColor = "#4096ff"; e.currentTarget.style.boxShadow = "none"; } }}
    onBlur={(e)  => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
  >
    {Icon && <Icon className="text-gray-400 text-[15px] flex-shrink-0" />}
    <input
      ref={ref} placeholder={placeholder} value={value} onChange={onChange} readOnly={readOnly}
      className={`border-none outline-none text-[13px] w-full bg-transparent font-medium h-full ${readOnly ? "text-gray-400 cursor-default" : ""}`}
      style={{ fontFamily: RB_FONT, color: readOnly ? undefined : "#0d1117" }}
    />
  </div>
));

const RB_FieldError = ({ msg }) => msg ? (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 mt-2">
    <IoAlertCircleOutline className="text-red-400 text-[14px] flex-shrink-0" />
    <p className="m-0 text-[12px] font-normal text-red-600" style={{ fontFamily: RB_FONT }}>{msg}</p>
  </div>
) : null;

const RB_ArchivedNotice = ({ message }) => (
  <div
    className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5"
    style={{ backgroundColor: "#fff7ed", border: "1px solid #fdba74" }}
  >
    <IoWarningOutline className="mt-0.5 text-[14px] flex-shrink-0" style={{ color: "#d97706" }} />
    <p className="m-0 text-[12px] leading-relaxed" style={{ color: "#9a3412", fontFamily: RB_FONT }}>
      {message}
    </p>
  </div>
);

const RB_Spinner = Spinner;

const RB_TailDropdown = ({ value, onChange, options, height = 38 }) => (
  <FilterButton value={value} onChange={onChange} options={options} height={height} width={160} />
);

const RB_EditBoatDrawer = ({ boat, open, onClose, onSuccess, onImageUploaded, onNoChanges, onError, boatTypes, owners }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [formData,     setFormData]     = useState({ boat_name: "", boat_type_id: "", status: "active", owner_id: "" });
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState({});

  const selectedOwner =
    owners.find((owner) => String(owner.owner_id) === String(formData.owner_id)) || boat?.owner || null;

  useEffect(() => {
    if (boat) {
      setFormData({
        boat_name:       boat.boat_name        || "",
        boat_type_id:    boat.boat_type_id     || "",
        status:          boat.status           || "active",
        owner_id:        boat.owner_id         || "",
      });
      setImagePreview(RB_getBoatImageSrc(boat));
      setImageFile(null);
      setLightboxOpen(false);
      setErrors({});
    }
  }, [boat]);

  const handleImageChange = (file) => {
    if (!file) return;

    if (file.size > MAX_BOAT_IMAGE_SIZE_BYTES) {
      showBottomToast(
        "error",
        "Image Too Large",
        `Boat image must be ${MAX_BOAT_IMAGE_SIZE_KB} KB or less.`
      );
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const ownerOptions = owners.map((owner) => ({
    value: owner.owner_id,
    label: RB_getOwnerLabel(owner),
    searchLabel: RB_getOwnerLabel(owner),
  }));

  const boatTypeOptions = boatTypes.map((type) => ({
    value: type.boat_type_id,
    label: RB_getBoatTypeLabel(type),
    searchLabel: RB_getBoatTypeLabel(type),
  }));

  if (!boat) return null;

  const validate = () => {
    const e = {};
    if (!formData.boat_name.trim()) e.boat_name    = "Boat name is required.";
    if (!formData.boat_type_id)     e.boat_type_id = "Please select a boat type.";
    if (!formData.owner_id)         e.owner_id     = "Please select an owner.";
    return e;
  };

  const hasChanges = () => {
    if (!boat) return true;
    const noFieldChange =
      formData.boat_name.trim() === (boat.boat_name || "").trim() &&
      String(formData.boat_type_id) === String(boat.boat_type_id || "") &&
      formData.status === (boat.status || "active") &&
      String(formData.owner_id) === String(boat.owner_id || "");
    return !noFieldChange || !!imageFile;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    if (!hasChanges()) {
      onClose();
      onNoChanges?.();
      return;
    }

    setLoading(true);
    setErrors((current) => ({ ...current, submit: "" }));
    try {
      const response = await api.put(`/boats/${boat.boat_id}`, {
        boat_name: formData.boat_name.trim(),
        boat_type_id: Number(formData.boat_type_id),
        owner_id: Number(formData.owner_id),
        status: formData.status,
      });
      const updatedBoat = {
        ...boat,
        ...(response?.data ?? {}),
        boat_id: boat.boat_id,
        status: response?.data?.status ?? formData.status,
        boat_name: response?.data?.boat_name ?? formData.boat_name.trim(),
        boat_type_id: response?.data?.boat_type_id ?? Number(formData.boat_type_id),
        owner_id: response?.data?.owner_id ?? Number(formData.owner_id),
        image_path: response?.data?.image_path ?? boat.image_path,
        image_public_id: response?.data?.image_public_id ?? boat.image_public_id,
        prev_status: boat.status || "active",
      };

      onSuccess?.(updatedBoat);
      onClose();

      uploadBoatImageInBackground({
        queryClient,
        boat: updatedBoat,
        imageFile,
        onUploaded: onImageUploaded,
      });
    } catch (err) {
      const message =
        err.response?.data?.errors?.image?.[0] ||
        err.response?.data?.errors?.boat_name?.[0] ||
        err.response?.data?.errors?.boat_type_id?.[0] ||
        err.response?.data?.errors?.owner_id?.[0] ||
        err.response?.data?.message ||
        "Failed to update boat.";
      setErrors({ submit: message });
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !boat) return null;

  return (
    <ConfigProvider theme={BA_antTheme}>
      <style>{`
        .boat-ant-select-dropdown {
          border-radius: 10px !important;
          overflow: hidden !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.13) !important;
          padding: 0 !important;
          z-index: 11000 !important;
        }
        .boat-ant-select-dropdown .ant-select-item {
          border-radius: 0 !important;
          padding: 8px 12px !important;
          font-family: ${BA_FONT} !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #1a1f36 !important;
        }
        .boat-ant-select-dropdown .ant-select-item-option-selected {
          background-color: #1a1f36 !important;
          color: #ffffff !important;
          font-weight: 400 !important;
        }
        .boat-ant-select-dropdown .ant-select-item-option-active:not(.ant-select-item-option-selected) {
          background-color: #f8fafc !important;
        }
        .boat-ant-select-error .ant-select-selector,
        .boat-ant-select-error.ant-select-focused .ant-select-selector,
        .boat-ant-select-error.ant-select-open .ant-select-selector,
        .boat-ant-select-error .ant-select-selector:hover {
          border-color: #fca5a5 !important;
        }
      `}</style>
      <Modal
        title="Edit Boat"
        onClose={loading ? undefined : onClose}
        onCancel={onClose}
        onSave={handleSubmit}
        saving={loading}
        saveDisabled={loading}
        saveLabel="Save"
        saveButtonWidth="170px"
        closeButtonWidth="170px"
        closeOnBackdrop
        maxWidth="980px"
        minimumSavingMs={0}
        bodyClassName="max-h-[64vh] overflow-y-auto !p-5"
      >
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <RB_FieldError msg={errors.submit} />
        <Card
          icon={IoImageOutline}
          title="BOAT IMAGE"
          subtitle="Upload a photo of the boat."
        >
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files[0])} className="hidden" />
            {imagePreview ? (
              <div className="flex flex-col gap-3">
                <div className="relative overflow-hidden rounded-[10px] border border-gray-200 bg-black">
                  <img src={imagePreview} alt="Boat preview" className="block w-full object-contain" style={{ maxHeight: 280 }} />
                  <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-2 px-3 py-2.5"
                    style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
                  >
                    <div />
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setLightboxOpen(true)} className="flex h-7 w-7 items-center justify-center rounded-[10px] border-none bg-white/20 text-white cursor-pointer transition-colors hover:bg-white/35">
                        <IoExpandOutline className="text-[14px]" />
                      </button>
                      <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); setLightboxOpen(false); }} className="flex h-7 w-7 items-center justify-center rounded-[10px] border-none bg-white/20 text-white cursor-pointer transition-colors hover:bg-red-500/70">
                        <IoCloseOutline className="text-[14px]" />
                      </button>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-[10px] border border-dashed border-gray-300 bg-[#fafbfc] py-2.5 text-[13px] font-medium text-gray-500 cursor-pointer transition-all hover:border-[#4096ff] hover:bg-blue-50 hover:text-[#4096ff]" style={{ fontFamily: BA_FONT }}>
                  Change Image
                </button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); handleImageChange(e.dataTransfer.files?.[0]); }}
                onDragOver={(e) => e.preventDefault()}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#4096ff"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#d1d5db"}
                className="flex min-h-[252px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed border-gray-300 bg-[#fafbfc] px-5 py-10 transition-colors hover:border-[#4096ff] hover:bg-blue-50"
              >
                <div className="flex h-[56px] w-[56px] items-center justify-center rounded-[10px] bg-blue-50">
                  <IoCloudUploadOutline className="text-[26px] text-blue-500" />
                </div>
                <p className="m-0 text-center text-[11px] font-semibold uppercase" style={{ color: "#6F6F82" }}>Click to upload boat image</p>
              </div>
            )}
        </Card>

        <div className="grid grid-cols-1 gap-6">
          <Card icon={IoBoatOutline} title="BOAT INFORMATION" subtitle="Basic details about the boat.">
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <BA_Label required>Boat Name</BA_Label>
                <BA_Input
                  placeholder="Enter boat name"
                  value={formData.boat_name}
                  onChange={(e) => { setFormData(f => ({ ...f, boat_name: e.target.value })); setErrors(er => ({ ...er, boat_name: "" })); }}
                  error={Boolean(errors.boat_name)}
                />
                <BA_FieldError msg={errors.boat_name} />
              </div>
              <div>
                <BA_Label required>Boat Type</BA_Label>
                <FilterSelect
                  className={`boat-ant-select ${errors.boat_type_id ? "boat-ant-select-error" : ""}`}
                  popupClassName="boat-ant-select-dropdown"
                  width="100%"
                  height={46}
                  style={{ width: "100%", height: 46, fontFamily: BA_FONT }}
                  showSearch
                  allowClear
                  placeholder="Select boat type"
                  optionFilterProp="searchLabel"
                  value={formData.boat_type_id || undefined}
                  onChange={(val) => { setFormData(f => ({ ...f, boat_type_id: val ?? "" })); setErrors(e => ({ ...e, boat_type_id: "" })); }}
                  filterOption={(input, option) => (option?.searchLabel ?? "").toLowerCase().includes(input.toLowerCase())}
                  options={boatTypeOptions}
                  getPopupContainer={() => document.body}
                  placement="bottomLeft"
                  notFoundContent="No types found"
                />
                <BA_FieldError msg={errors.boat_type_id} />
              </div>
            </div>
            <div>
              <BA_Label>Status</BA_Label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {BA_STATUS_OPTIONS.map((option) => {
                  const active = formData.status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, status: option.value }))}
                      className={`flex h-[46px] items-center justify-center rounded-[10px] border-2 px-3 text-[11px] font-semibold uppercase cursor-pointer transition-all ${active ? option.active : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50"}`}
                      style={{ fontFamily: BA_FONT }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card icon={IoPersonOutline} title="OWNER INFORMATION" subtitle="Details about the boat owner.">
            <div className="mb-4">
              <BA_Label required>Owner Name</BA_Label>
              <FilterSelect
                className={`boat-ant-select ${errors.owner_id ? "boat-ant-select-error" : ""}`}
                popupClassName="boat-ant-select-dropdown"
                width="100%"
                height={46}
                style={{ width: "100%", height: 46, fontFamily: BA_FONT }}
                showSearch
                allowClear
                placeholder="Select from registered boat owners"
                optionFilterProp="searchLabel"
                value={formData.owner_id || undefined}
                onChange={(val) => { setFormData(f => ({ ...f, owner_id: val ?? "" })); setErrors(e => ({ ...e, owner_id: "" })); }}
                filterOption={(input, option) => (option?.searchLabel ?? "").toLowerCase().includes(input.toLowerCase())}
                options={ownerOptions}
                getPopupContainer={() => document.body}
                placement="bottomLeft"
                notFoundContent="No owners found"
              />
              <BA_FieldError msg={errors.owner_id} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <BA_Label>Owner Address</BA_Label>
                <BA_Input value={selectedOwner?.address ?? ""} readOnly wrapperClassName="!bg-slate-100" />
              </div>
              <div>
                <BA_Label>Contact Number</BA_Label>
                <BA_Input value={selectedOwner?.contact_number ?? ""} readOnly wrapperClassName="!bg-slate-100" />
              </div>
            </div>
          </Card>
        </div>
      </div>
      </Modal>
      {lightboxOpen && imagePreview ? <BA_Lightbox src={imagePreview} onClose={() => setLightboxOpen(false)} /> : null}
    </ConfigProvider>
  );
};

const RB_TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#1a1f36", backgroundColor: "#ffffff", borderBottom: "2px solid #e5e7eb" }}>
    {children}
  </th>
);

const RB_RegisteredBoats = ({ openAddBoatOnMount = false }) => {
  const location = useLocation();
  const highlightedSearchResult = location.state?.universalSearchResult ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cachedRegisteredBoatsData = queryClient.getQueriesData({ queryKey: ["registered-boats-data"] })
    .find(([, data]) => data?.boats)?.[1];
  const [activeItem,     setActiveItem]     = useState("Boat Management");
  const [contentMargin,  setContentMargin]  = useState(() => window.innerWidth >= 900 ? 256 : 0);
  const [boats,          setBoats]          = useState(() => cachedRegisteredBoatsData?.boats ?? []);
  const [boatTypes,      setBoatTypes]      = useState(() => cachedRegisteredBoatsData?.boatTypes ?? []);
  const [owners,         setOwners]         = useState(() => cachedRegisteredBoatsData?.owners ?? []);
  const [fetching,       setFetching]       = useState(() => !cachedRegisteredBoatsData?.boats);
  const [requestedPage,  setRequestedPage]  = useState(1);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [selectedBoat,   setSelectedBoat]   = useState(null);
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [ownerFilter,    setOwnerFilter]    = useState("all");
  const [boatTypeFilter, setBoatTypeFilter] = useState("all");
  const { isTransactionLocked, transactionLockMessage } = useTransactionLockQuery("boat-management");
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingBoat,    setEditingBoat]    = useState(null);
  const [deleteModal,    setDeleteModal]    = useState({ open: false, boat: null });
  const [addBoatModalOpen, setAddBoatModalOpen] = useState(false);
  const [registrationInitialData, setRegistrationInitialData] = useState(null);
  const isHeadViewOnly = isHeadRole();
  const urlFiltersKeyRef = useRef(null);

  const debouncedSearch = BM_useDebouncedValue(search);
  const rawHighlightedBoatId = BM_getHighlightId({
    highlightedSearchResult,
    group: "Registered Boats",
    prefix: "boat-",
    search: location.search,
  });
  const highlightToken = rawHighlightedBoatId
    ? `${rawHighlightedBoatId}|${location.search}|${highlightedSearchResult?.group || ""}`
    : "";
  const [dismissedHighlightToken, setDismissedHighlightToken] = useState("");
  const highlightedBoatId = dismissedHighlightToken === highlightToken ? "" : rawHighlightedBoatId;
  const clearUniversalHighlight = useCallback(() => {
    if (highlightToken) {
      setDismissedHighlightToken(highlightToken);
    }
    BM_clearUniversalHighlight({ highlightedSearchResult, location, navigate });
  }, [highlightToken, highlightedSearchResult, location, navigate]);
  useEffect(() => {
    setDismissedHighlightToken("");
  }, [location.key]);
  useEffect(() => {
    if (!openAddBoatOnMount) return;
    if (isHeadViewOnly) return;
    let cancelled = false;
    const visit = location.state?.registrationVisit;
    const openRegistration = async () => {
      try {
        let initialData = null;
        if (visit && ["docking", "banyera"].includes(visit.source) && Number.isSafeInteger(Number(visit.id))) {
          const endpoint = visit.source === "docking" ? "dockings" : "banyera-transactions";
          const response = await api.get(`/${endpoint}/${Number(visit.id)}`);
          initialData = getVisitingBoatRegistrationData(response.data);
          if (!initialData) throw new Error("This visit is no longer available for boat registration.");
        }
        if (cancelled) return;
        setRegistrationInitialData(initialData);
        setAddBoatModalOpen(true);
      } catch (error) {
        if (!cancelled) showBottomToast("error", "Registration Unavailable", error.response?.data?.message || error.message);
      } finally {
        if (!cancelled) navigate("/registered-boats", { replace: true });
      }
    };
    void openRegistration();
    return () => { cancelled = true; };
  }, [isHeadViewOnly, navigate, openAddBoatOnMount, location.state]);
  const boatsQuery = useRegisteredBoatsDataQuery(
    {
      boatsPage: currentPage,
      boatTypesPage: 1,
      ownersPage: 1,
      perPage: RB_PAGE_SIZE,
      boatsSearch: debouncedSearch,
      boatsStatus: statusFilter,
      owner: ownerFilter,
      boatType: boatTypeFilter,
      highlightBoatId: highlightedBoatId,
      boatsPaginated: true,
      boatTypesPaginated: false,
      ownersPaginated: false,
      includeBoats: true,
      includeBoatTypes: true,
      includeOwners: true,
      includeArchivedLookups: false,
    }
  );
  // boat types and owners are provided by the registered-boats-data request
  // avoid separate /boat-management calls to reduce duplicate requests
  const boatTypesQuery = { data: { boatTypes: boatsQuery.data?.boatTypes }, isLoading: false };
  const boatOwnersQuery = { data: { owners: boatsQuery.data?.owners }, isLoading: false };
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleSidebar } = useSidebar();
  const handleWidthChange = useCallback((w) => setContentMargin(w), []);

  const showToast = (type, title, message) => {
    if (type === "info" && title === "No Changes Made") {
      showNoChangesToast();
      return;
    }
    showBottomToast(type, title, message);
  };

  const refreshBoatDependentModules = () => {
    void queryClient.invalidateQueries({ queryKey: ["dockings-data"], refetchType: "active" });
    void queryClient.invalidateQueries({ queryKey: ["docking-lookups"], refetchType: "active" });
    void queryClient.invalidateQueries({ queryKey: ["dockings-calendar"], refetchType: "active" });
    void queryClient.invalidateQueries({ queryKey: ["banyera-data"], refetchType: "active" });
    void queryClient.invalidateQueries({ queryKey: ["registered-boats-report"], refetchType: "active" });
    void queryClient.invalidateQueries({ queryKey: ["boat-types-report"], refetchType: "active" });
  };

  useEffect(() => {
    setFetching(boatsQuery.isLoading && !boatsQuery.data && boats.length === 0);
  }, [boats.length, boatsQuery.data, boatsQuery.isLoading]);

  useEffect(() => {
    if (window.innerWidth >= 900 && sidebarOpen) setContentMargin(sidebarCollapsed ? 72 : 256);
    else if (window.innerWidth < 900) setContentMargin(0);
  }, [sidebarCollapsed, sidebarOpen]);

  useEffect(() => {
    if (boatsQuery.data) {
      setBoats(boatsQuery.data.boats ?? []);
    }
  }, [boatsQuery.data]);

  useEffect(() => {
    if (boatsQuery.data?.boatTypes) {
      setBoatTypes(boatsQuery.data.boatTypes);
      queryClient.setQueryData(["boat-types"], boatsQuery.data.boatTypes);
    }
  }, [boatTypesQuery.data, queryClient]);

  useEffect(() => {
    if (boatsQuery.data?.owners) {
      setOwners(boatsQuery.data.owners);
      queryClient.setQueryData(["boat-owners"], boatsQuery.data.owners);
    }
  }, [boatOwnersQuery.data, queryClient]);

  useEffect(() => {
    if (!highlightedBoatId) return;
    const resolvedPage = Number(boatsQuery.data?.boatsMeta?.current_page || 0);
    if (resolvedPage > 0 && (resolvedPage !== currentPage || resolvedPage !== requestedPage)) {
      setRequestedPage(resolvedPage);
      setCurrentPage(resolvedPage);
    }
  }, [currentPage, highlightedBoatId, boatsQuery.data?.boatsMeta?.current_page, requestedPage]);

  useEffect(() => {
    if (boatsQuery.isError) {
      showToast("error", "Error", "Failed to load data.");
    }
  }, [boatsQuery.isError]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextOwnerFilter = params.get("ownerId") || "all";
    const nextBoatTypeFilter = params.get("boatTypeId") || "all";
    const nextSearch = params.get("q") || "";
    const nextUrlFiltersKey = JSON.stringify({
      owner: nextOwnerFilter,
      boatType: nextBoatTypeFilter,
      search: nextSearch,
    });
    const filtersChanged = urlFiltersKeyRef.current !== null && urlFiltersKeyRef.current !== nextUrlFiltersKey;
    urlFiltersKeyRef.current = nextUrlFiltersKey;

    setOwnerFilter(nextOwnerFilter);
    setBoatTypeFilter(nextBoatTypeFilter);
    setSearch(nextSearch);

    if (filtersChanged) {
      setRequestedPage(1);
      setCurrentPage(1);
    }
  }, [highlightedSearchResult, location.search]);

  const handleDelete = async () => {
    const { boat } = deleteModal;
    try {
      await api.patch(`/boats/${boat.boat_id}/archive`);
      setBoats(prev => prev.filter(b => b.boat_id !== boat.boat_id));
      archiveRegisteredBoatInDataCache(queryClient, boat);
      setDeleteModal({ open: false, boat: null });
      showToast("success", "Boat Archived", `"${boat.boat_name}" has been archived successfully.`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["boats"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["archives-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dockings-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["docking-lookups"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dockings-calendar"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["banyera-data"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["registered-boats-report"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["boat-types-report"], refetchType: "active" }),
      ]);
    } catch (err) {
      showToast("error", "Archive Failed", err.response?.data?.message ?? "Failed to archive boat.");
      throw err;
    }
  };

  const handleEditSuccess = (updatedBoat) => {
    showUpdatedToast("Boat", "boat details");

    if (updatedBoat?.boat_id) {
      setBoats((prev) => prev.map((boat) =>
        String(boat.boat_id) === String(updatedBoat.boat_id)
          ? { ...boat, ...updatedBoat }
          : boat
      ));
      setSelectedBoat((prev) =>
        prev && String(prev.boat_id) === String(updatedBoat.boat_id)
          ? { ...prev, ...updatedBoat }
          : prev
      );
      updateRegisteredBoatsDataCache(queryClient, updatedBoat);
    }

    // Ensure both the lightweight boats query and the registered-boats-data cache are refreshed
    void queryClient.invalidateQueries({ queryKey: ["boats"], refetchType: "active" });
    void queryClient.invalidateQueries({ queryKey: ["registered-boats-data"], refetchType: "active" });
    refreshBoatDependentModules();
  };

  const handleEditNoChanges = () => {
    showToast("info", "No Changes Made", "No changes were made. The record remains the same.");
  };

  const handleBoatImageUploaded = (updatedBoat) => {
    if (!updatedBoat?.boat_id) return;

    setBoats((prev) => prev.map((boat) =>
      String(boat.boat_id) === String(updatedBoat.boat_id)
        ? { ...boat, ...updatedBoat }
        : boat
    ));
    setSelectedBoat((prev) =>
      prev && String(prev.boat_id) === String(updatedBoat.boat_id)
        ? { ...prev, ...updatedBoat }
        : prev
    );
  };

  const ownerFilterOptions = RB_buildOwnerFilterOptions(owners);
  const boatTypeFilterOptions = RB_buildBoatTypeFilterOptions(boatTypes);

  const paginated = boats;
  const boatsMeta = boatsQuery.data?.boatsMeta ?? BM_buildLocalMeta(boats, currentPage, RB_PAGE_SIZE);
  const totalPages = Math.max(1, Number(boatsMeta.last_page || 1));
  const safePage = Math.min(requestedPage, totalPages);
  const highlightedBoatIndex = highlightedBoatId
    ? boats.findIndex((boat) => String(highlightedBoatId) === String(boat.boat_id))
    : -1;

  useEffect(() => {
    if (highlightedBoatIndex < 0) return;
    setRequestedPage(Math.max(1, Number(boatsMeta.current_page || 1)));
    setCurrentPage(Math.max(1, Number(boatsMeta.current_page || 1)));
  }, [highlightedBoatIndex, boatsMeta.current_page]);

  useEffect(() => {
    setRequestedPage(1);
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, ownerFilter, boatTypeFilter]);

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

  const overviewData = BM_getCachedOverviewData(queryClient) ?? boatsQuery.data;
  const overviewLoading = !overviewData && boatsQuery.isLoading;
  const overviewStats = BM_getOverviewStats(overviewData, { boats, boatTypes, owners });

  return (
    <ConfigProvider theme={RB_antTheme}>
      <style>{`
        * { font-family: ${RB_FONT} !important; }
        input::placeholder { color: #1a1f36 !important; opacity: 0.4; }
        .boat-ant-select .ant-select-selector { border-radius: 12px !important; border: 1px solid #e5e7eb !important; font-family: ${RB_FONT} !important; font-size: 13px !important; font-weight: 500 !important; box-shadow: none !important; transition: border-color 0.15s, box-shadow 0.15s !important; }
        .boat-ant-select.ant-select-focused .ant-select-selector, .boat-ant-select.ant-select-open .ant-select-selector { border-color: #4096ff !important; box-shadow: none !important; }
        .boat-ant-select .ant-select-selector:hover { border-color: #4096ff !important; }
        .boat-ant-select .ant-select-selection-item, .boat-ant-select .ant-select-selection-search-input { font-family: ${RB_FONT} !important; font-size: 13px !important; font-weight: 500 !important; color: #0d1117 !important; }
        .boat-ant-select .ant-select-selection-placeholder { font-family: ${RB_FONT} !important; font-size: 13px !important; color: rgba(26,31,54,0.4) !important; }
        .boat-ant-select .ant-select-arrow { color: #9ca3af !important; }
        .boat-ant-select-dropdown { border-radius: 12px !important; overflow: hidden !important; box-shadow: 0 4px 24px rgba(0,0,0,0.13) !important; border: 1px solid #e5e7eb !important; padding: 4px !important; }
        .boat-ant-select-dropdown .ant-select-item { font-family: ${RB_FONT} !important; font-size: 13px !important; font-weight: 500 !important; border-radius: 8px !important; color: #1a1f36 !important; padding: 8px 12px !important; }
        .boat-ant-select-dropdown .ant-select-item-option-selected { background-color: #1a1f36 !important; color: #fff !important; font-weight: 400 !important; }
        .boat-ant-select-dropdown .ant-select-item-option-active:not(.ant-select-item-option-selected) { background-color: #f8fafc !important; }
      `}</style>

      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#ffffff" }}>
        <Sidebar activeItem={activeItem} setActiveItem={setActiveItem} open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} onWidthChange={handleWidthChange} />

        <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden" style={{ marginLeft: sidebarOpen && window.innerWidth >= 900 ? `${contentMargin}px` : "0px" }}>
          <Topbar sidebarOpen={sidebarOpen} sidebarCollapsed={sidebarCollapsed} onMenuToggle={toggleSidebar} />

          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6 xl:px-8" style={{ backgroundColor: "#ffffff" }}>
            <div className="mx-auto w-full max-w-[1440px]">

            <BM_Header
              title="Registered Boats"
              subtitle="View boat registration details and current status."
              fontFamily={RB_FONT}
              loading={overviewLoading}
            />

            <BM_OverviewGrid stats={overviewStats} loading={overviewLoading} />

            <Tabs
              tabs={[{ key: "records", label: "Registered Boats", icon: IoBoatOutline }]}
              activeKey="records"
              fontFamily={RB_FONT}
              className="mb-5"
              loading={overviewLoading}
              rightContent={<Legend items={RB_BOAT_STATUS_LEGEND} loading={overviewLoading} />}
            >
            <TableCard
              title="Registered Boat Records"
              subtitle="All registered boats in the system"
              className="table-card--image-first-column"
              loading={overviewLoading}
              headerActionsSkeletonCount={isHeadViewOnly ? 2 : 3}
              pagination={{
                meta: boatsMeta,
                total: boatsMeta.total,
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
                    style={{ height: 42, width: 300 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#4096ff"; e.currentTarget.style.boxShadow = "none"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <IoSearchOutline className="text-[17px] flex-shrink-0" style={{ color: "#1a1f36" }} />
                    <input type="text" placeholder="Search for boat name, type, owner" value={search} onChange={e => { clearUniversalHighlight(); setSearch(e.target.value); setRequestedPage(1); setCurrentPage(1); }}
                      className="bg-transparent border-none outline-none text-[13px] w-full" style={{ fontFamily: RB_FONT, color: "#1a1f36" }} />
                  </div>
                  <RB_TailDropdown value={statusFilter} onChange={v => { clearUniversalHighlight(); setStatusFilter(v); setRequestedPage(1); setCurrentPage(1); }} options={RB_STATUS_FILTER_OPTIONS} height={42} />
                  {!isHeadViewOnly ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearUniversalHighlight();
                        if (isTransactionLocked) {
                          showBottomToast("error", "Transactions Locked", transactionLockMessage);
                          return;
                        }
                        setAddBoatModalOpen(true);
                      }}
                      disabled={isTransactionLocked}
                      className="flex h-[42px] items-center justify-center gap-2 rounded-[10px] border-none px-4 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed"
                      style={{
                        fontFamily: RB_FONT,
                        backgroundColor: isTransactionLocked ? "#94a3b8" : "#1a1f36",
                        cursor: isTransactionLocked ? "not-allowed" : "pointer",
                      }}
                      onMouseEnter={(event) => {
                        if (!isTransactionLocked) event.currentTarget.style.backgroundColor = "#2d3561";
                      }}
                      onMouseLeave={(event) => {
                        if (!isTransactionLocked) event.currentTarget.style.backgroundColor = "#1a1f36";
                      }}
                    >
                      <IoAddOutline className="text-[16px]" />
                      <span>Add Boat</span>
                    </button>
                  ) : null}
                </>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 930 }}>
                  <thead>
                      <tr>
                        <RB_TH>Image</RB_TH><RB_TH>Boat Name</RB_TH><RB_TH>Type</RB_TH><RB_TH>Owner</RB_TH>
                        <RB_TH>Contact</RB_TH><RB_TH>Date Registered</RB_TH>{!isHeadViewOnly ? <RB_TH align="right">Action</RB_TH> : null}
                      </tr>
                  </thead>
                  <tbody>
                    {fetching ? (
                      Array.from({ length: RB_PAGE_SIZE }).map((_, i) => (
                        <tr key={i} className="animate-pulse" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td className="px-4 py-3"><div className="w-10 h-10 rounded-lg bg-slate-100" /></td>
                          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-28" /></td>
                          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-28" /></td>
                          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                          <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded-md w-20" /></td>
                          {!isHeadViewOnly ? <td className="px-4 py-3"><div className="flex gap-2"><div className="w-8 h-8 rounded-lg bg-slate-100" /><div className="w-8 h-8 rounded-lg bg-slate-100" /></div></td> : null}
                        </tr>
                      ))
                    ) : paginated.length === 0 ? (
                      <tr><td colSpan={isHeadViewOnly ? 6 : 7}>
                        <NoDataFound title={search || statusFilter !== "all" || ownerFilter !== "all" || boatTypeFilter !== "all" ? "No results found" : "No Data Found"} />
                      </td></tr>
                    ) : paginated.map((boat, index) => {
                      const ownerName = RB_getOwnerName(boat.owner);
                      const boatType  = RB_getBoatType(boat);
                      const imageSrc  = RB_getBoatImageSrc(boat);
                      const isHighlighted =
                        highlightedBoatId &&
                        String(highlightedBoatId) === String(boat.boat_id);
                      return (
                        <tr key={boat.boat_id} className={`cursor-pointer transition-colors ${highlightedSearchResult ? "table-row-plain" : index % 2 === 0 ? "table-row-even" : "table-row-odd"} ${isHighlighted ? "universal-search-highlight" : ""}`.trim()} style={{
                          borderBottom: "1px solid #f1f5f9",
                        }}
                          onClick={() => { setSelectedBoat(boat); setDrawerOpen(true); }}
                        >
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="relative flex h-[40px] w-[40px] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-blue-50 p-0">
                              {imageSrc ? (
                                <img
                                  src={imageSrc}
                                  alt={boat.boat_name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = "";
                                    e.currentTarget.style.display = "none";
                                    const fallback = e.currentTarget.nextElementSibling;
                                    if (fallback) fallback.style.display = "flex";
                                  }}
                                />
                              ) : null}
                              <div className="hidden h-full w-full items-center justify-center">
                                <IoImageOutline className="text-[18px] text-blue-300" />
                              </div>
                              {!imageSrc ? <IoImageOutline className="text-[18px] text-blue-300" /> : null}
                              <span
                                className="absolute bottom-1 right-1 inline-block h-2.5 w-2.5 rounded-full border border-white"
                                style={{ backgroundColor: RB_getBoatStatusIndicatorColor(boat.status) }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px] font-normal" style={{ color: "#1a1f36" }}>{boat.boat_name}</td>
                          <td className="px-4 py-3 text-[13px] font-normal" style={{ color: "#1a1f36" }}>{boatType?.type_name ?? "-"}</td>
                          <td className="px-4 py-3 text-[13px] font-normal" style={{ color: "#1a1f36" }}>{ownerName}</td>
                          <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: "#1a1f36" }}>{boat.owner?.contact_number ?? "-"}</td>
                          <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: "#1a1f36" }}>{RB_formatDate(boat.created_at)}</td>
                          {!isHeadViewOnly ? (
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-start gap-2">
                                <Tooltip title={isTransactionLocked ? transactionLockMessage : "Edit"}>
                                  <button onClick={(e) => { e.stopPropagation(); if (isTransactionLocked) return; setEditingBoat(boat); setEditDrawerOpen(true); }}
                                    disabled={isTransactionLocked}
                                    className="w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer bg-white hover:bg-blue-50 transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-60"
                                    style={{ borderColor: isTransactionLocked ? undefined : "#1a1f36" }}
                                  ><IoCreateOutline style={{ fontSize: "15px", color: isTransactionLocked ? "#94a3b8" : "#1a1f36" }} /></button>
                                </Tooltip>
                                <Tooltip title={isTransactionLocked ? transactionLockMessage : "Archive"}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isTransactionLocked) return;
                                      setDeleteModal({ open: true, boat });
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
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
            </TableCard>
            </Tabs>
            </div>
          </main>
        </div>
      </div>

      <RB_RegisteredBoatDetailsDrawer boat={selectedBoat} open={drawerOpen} onClose={() => setDrawerOpen(false)} boatTypes={boatTypes} owners={owners} />
      {!isHeadViewOnly ? <RB_EditBoatDrawer
        boat={editingBoat}
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={handleEditSuccess}
        onImageUploaded={handleBoatImageUploaded}
        onNoChanges={handleEditNoChanges}
        onError={(message) => showToast("error", "Update Failed", message)}
        boatTypes={boatTypes}
        owners={owners}
      /> : null}
      {!isHeadViewOnly ? <BA_AddBoatModal
        open={addBoatModalOpen}
        initialData={registrationInitialData}
        onClose={() => { setAddBoatModalOpen(false); setRegistrationInitialData(null); }}
        onImageUploaded={handleBoatImageUploaded}
        boatTypes={boatTypes}
        owners={owners}
        loading={boatsQuery.isLoading && !boatsQuery.data}
        onSuccess={(createdBoat) => {
          setAddBoatModalOpen(false);
          setRegistrationInitialData(null);
          if (createdBoat?.boat_id) {
            setBoats((prev) => [
              createdBoat,
              ...prev.filter((boat) => String(boat.boat_id) !== String(createdBoat.boat_id)),
            ].slice(0, RB_PAGE_SIZE));
          }
          void queryClient.invalidateQueries({ queryKey: ["boats"], refetchType: "active" });
          void queryClient.invalidateQueries({ queryKey: ["registered-boats-data"], refetchType: "active" });
          refreshBoatDependentModules();
        }}
      /> : null}
      {!isHeadViewOnly ? <ArchiveModal
        open={deleteModal.open}
        title="Archive Boat"
        itemName={deleteModal.boat?.boat_name ?? ""}
        onClose={() => setDeleteModal({ open: false, boat: null })}
        onConfirm={handleDelete}
      /> : null}
    </ConfigProvider>
  );
};

const RB_BoatDrawer = ({ boat, open, onClose }) => {
  if (!boat) return null;
  const ds        = RB_statusStyle(boat.status);
  const ownerName = RB_getOwnerName(boat.owner);
  const boatType  = RB_getBoatType(boat);
  const createdBy = RB_getCreatedBy(boat);
  const imageSrc  = RB_getBoatImageSrc(boat);
  return (
    <AntDrawer open={open} onClose={onClose} width={460} closable={false} styles={{ body: { padding: 0, fontFamily: RB_FONT, backgroundColor: "#f8fafc" }, header: { display: "none" } }}>
      <div className="h-[180px] relative overflow-hidden">
        {imageSrc
          ? <img src={imageSrc} alt={boat.boat_name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; e.target.parentNode.style.backgroundColor = "#1a1f36"; }} />
          : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#1a1f36" }}><IoBoatOutline className="text-white/20 text-[64px]" /></div>
        }
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(26,31,54,0.95) 0%, rgba(26,31,54,0.3) 100%)" }} />
        <button onClick={onClose} className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/15 text-white border-none cursor-pointer flex items-center justify-center hover:bg-white/25">
          <IoCloseOutline className="text-lg" />
        </button>
        <div className="absolute bottom-3.5 left-5">
          <p className="m-0 text-lg font-bold text-white mb-0.5">{boat.boat_name}</p>
          <span className="text-xs text-white/60">{boatType?.type_name ?? "-"}</span>
        </div>
      </div>
      <div className="px-5 py-3 border-b border-slate-100">
        <StatusPill status={ds.key} label={ds.label} />
      </div>
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="m-0 mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Boat Owner</p>
        <div className="flex items-center gap-3 mb-3.5">
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #60a5fa, #3b82f6)" }}>
            <span className="text-base font-bold text-white">{boat.owner?.owner_firstname?.charAt(0) ?? "?"}</span>
          </div>
          <div>
            <p className="m-0 text-sm font-bold" style={{ color: "#1a1f36" }}>{ownerName}</p>
            <p className="m-0 text-xs text-slate-400">Registered Owner</p>
          </div>
        </div>
        {[
          { icon: IoPersonOutline,   label: "Full Name", value: ownerName },
          { icon: IoLocationOutline, label: "Address",   value: boat.owner?.address        ?? "-" },
          { icon: IoCallOutline,     label: "Contact",   value: boat.owner?.contact_number ?? "-" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 mb-2">
            <div className="w-[30px] h-[30px] rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><Icon className="text-blue-500 text-sm" /></div>
            <div><p className="m-0 text-[11px] text-slate-400">{label}</p><p className="m-0 text-[13px] font-medium text-slate-700">{value}</p></div>
          </div>
        ))}
      </div>
      <div className="px-5 py-4">
        <p className="m-0 mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Boat Information</p>
        {[
          { icon: IoBoatOutline,         label: "Boat Name",       value: boat.boat_name },
          { icon: IoLayersOutline,       label: "Type",            value: boatType?.type_name ?? "-" },
          { icon: IoCalendarOutline,     label: "Date Registered", value: RB_formatDate(boat.created_at) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 mb-2">
            <div className="w-[30px] h-[30px] rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><Icon className="text-blue-500 text-sm" /></div>
            <div><p className="m-0 text-[11px] text-slate-400">{label}</p><p className="m-0 text-[13px] font-medium text-slate-700">{value}</p></div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-6 flex gap-2.5">
        <button className="flex-1 py-2.5 rounded-xl text-white border-none cursor-pointer text-[13px] font-semibold transition-colors" style={{ backgroundColor: "#1a1f36" }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#2d3561"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#1a1f36"}
        >Edit Details</button>
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 border-none cursor-pointer text-[13px] font-semibold hover:bg-slate-200 transition-colors" style={{ color: "#1a1f36" }}>Close</button>
      </div>
    </AntDrawer>
  );
};

const RB_RegisteredBoatDetailsDrawer = ({ boat, open, onClose, boatTypes, owners }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!open) setLightboxOpen(false);
  }, [open]);

  if (!boat) return null;
  const ds = RB_statusStyle(boat.status);
  const ownerName = RB_getOwnerName(boat.owner);
  const boatType = RB_getBoatType(boat);
  const createdBy = RB_getCreatedBy(boat);
  const imageSrc = RB_getBoatImageSrc(boat);
  const ownerIsArchived = !!(boat.owner_id && !owners.some((owner) => owner.owner_id === boat.owner_id));
  const boatTypeIsArchived = !!(boat.boat_type_id && !boatTypes.some((type) => type.boat_type_id === boat.boat_type_id));

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      width={460}
      fontFamily={RB_FONT}
      title="Boat Details"
      subtitle="Review the selected boat record."
      icon={IoBoatOutline}
    >
      <DrawerSection
        icon={IoImageOutline}
        title="Boat Image"
        subtitle="Registered image for this boat"
        fontFamily={RB_FONT}
      >
            <div className="relative h-[220px] overflow-hidden border border-gray-200 bg-blue-50 flex items-center justify-center" style={{ borderRadius: 10 }}>
              {imageSrc
                ? <img src={imageSrc} alt={boat.boat_name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
                : <IoBoatOutline className="text-blue-300 text-[52px]" />}
              {imageSrc ? (
                <div
                  className="absolute left-0 right-0 top-0 flex items-center justify-end px-3 py-2.5"
                  style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
                >
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-[10px] border-none bg-white/20 text-white cursor-pointer transition-colors hover:bg-white/35"
                  >
                    <IoExpandOutline className="text-[14px]" />
                  </button>
                </div>
              ) : null}
              <span
                className="absolute bottom-3 right-3 inline-block h-4 w-4 rounded-full border-2 border-white"
                style={{ backgroundColor: RB_getBoatStatusIndicatorColor(boat.status) }}
              />
            </div>
      </DrawerSection>

      <DrawerSection
        icon={IoDocumentTextOutline}
        title="Registration Info"
        subtitle="Registered details for this boat"
        fontFamily={RB_FONT}
      >
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Boat Name", value: boat.boat_name ?? "-", className: "col-span-2" },
                { label: "Boat Type", value: boatType?.type_name ?? "-" },
                { label: "Date Registered", value: RB_formatDate(boat.created_at) },
                { label: "Created By", value: RB_getCreatedByLabel(boat), className: "col-span-2" },
              ].map(({ label, value, className }) => (
                <DrawerInfoCard key={label} label={label} value={value} className={className} />
              ))}
            </div>
            {boatTypeIsArchived && (
              <RB_ArchivedNotice message={`This boat is linked to an archived boat type (${RB_getBoatTypeLabel(boatType)}). Restore the boat type from Archives or assign a new active boat type when editing this record.`} />
            )}
      </DrawerSection>
      <DrawerSection
        icon={IoPersonOutline}
        title="Boat Owner"
        subtitle="Owner information linked to this boat"
        fontFamily={RB_FONT}
      >
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: "Full Name", value: ownerName },
                { label: "Address", value: boat.owner?.address ?? "-" },
                { label: "Contact Number", value: boat.owner?.contact_number ?? "-" },
              ].map(({ label, value }) => (
                <DrawerInfoCard key={label} label={label} value={value} />
              ))}
            </div>
            {ownerIsArchived && (
              <RB_ArchivedNotice message={`This boat is linked to an archived owner (${ownerName}). Restore the owner from Archives or assign a new active owner when editing this record.`} />
            )}
      </DrawerSection>
      {lightboxOpen && imageSrc ? <BA_Lightbox src={imageSrc} onClose={() => setLightboxOpen(false)} /> : null}
    </DetailDrawer>
  );
};

const BA_FONT = "'Montserrat', sans-serif";

const BA_STATUS_OPTIONS = [
  { value: "active", label: "Active", active: "border-emerald-600 bg-emerald-50 text-emerald-700" },
  { value: "expired", label: "Expired", active: "border-red-500 bg-red-50 text-red-700" },
  { value: "suspended", label: "Suspended", active: "border-amber-500 bg-amber-50 text-amber-700" },
  { value: "under_repair", label: "Under Repair", active: "border-violet-500 bg-violet-50 text-violet-700" },
];

const BA_antTheme = {
  token: {
    colorPrimary: "#4096ff",
    colorPrimaryHover: "#4096ff",
    colorPrimaryActive: "#4096ff",
    borderRadius: 10,
    fontFamily: BA_FONT,
    controlHeight: 46,
    fontSize: 13,
  },
};

const BA_getOwnerLabel = (owner) =>
  `${owner?.owner_firstname ?? ""} ${owner?.owner_lastname ?? ""}`.trim() || owner?.owner_name || "-";

const BA_Label = ({ children, required }) => (
  <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: "#6F6F82", fontFamily: BA_FONT }}>
    {children}
    {required && <span className="ml-0.5 text-red-500">*</span>}
  </label>
);

const BA_Input = React.forwardRef(({ icon: Icon, readOnly = false, error = false, wrapperClassName = "", ...props }, ref) => (
  <div
    className={`flex items-center gap-2.5 px-3.5 border transition-all bg-white ${error && !readOnly ? "border-red-300" : readOnly ? "border-slate-200" : "border-slate-200 focus-within:border-[#4096ff]"} ${wrapperClassName}`}
    style={{ height: 46, borderRadius: 10 }}
  >
    {Icon && <Icon className="text-[15px] text-slate-400 flex-shrink-0" />}
    <input
      ref={ref}
      readOnly={readOnly}
      {...props}
      className={`h-full w-full border-none bg-transparent text-[13px] font-medium outline-none placeholder:font-normal placeholder:text-slate-400 ${readOnly ? "cursor-default text-[#0d1117]" : "text-[#0d1117]"}`}
      style={{ fontFamily: BA_FONT }}
    />
  </div>
));

const BA_FieldError = ({ msg }) =>
  msg ? (
    <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2">
      <IoAlertCircleOutline className="text-[14px] text-red-400 flex-shrink-0" />
      <p className="m-0 text-[12px] font-normal text-red-600" style={{ fontFamily: BA_FONT }}>
        {msg}
      </p>
    </div>
  ) : null;

const BA_Lightbox = ({ src, onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" onClick={onClose}>
    <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
      <img src={src} alt="Boat preview" className="w-full rounded-[10px] object-contain shadow-2xl" style={{ maxHeight: "85vh" }} />
      <button
        onClick={onClose}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[10px] border-none bg-black/60 text-white cursor-pointer"
      >
        <IoCloseOutline className="text-xl" />
      </button>
    </div>
  </div>
);

const BA_AddBoatModal = ({ open, initialData = null, onClose, onSuccess, onImageUploaded, boatTypes = [], owners = [], loading = false }) => {
  const queryClient = useQueryClient();
  const { isTransactionLocked, transactionLockMessage } = useTransactionLockQuery("boat-management");
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const [form, setForm] = useState({
    boat_name: "",
    boat_type_id: "",
    status: "active",
    owner_id: "",
    image_preview: null,
    image_path: "",
  });
  const [errors, setErrors] = useState({});

  const fileInputRef = useRef(null);
  const boatNameRef = useRef(null);
  const boatTypeRef = useRef(null);
  const ownerRef = useRef(null);

  const handleReset = useCallback(() => {
    setForm({
      boat_name: "",
      boat_type_id: "",
      status: "active",
      owner_id: "",
      image_preview: null,
      image_path: "",
    });
    setImageFile(null);
    setLightbox(false);
    setErrors({});
  }, []);

  useEffect(() => {
    if (open) return;
    handleReset();
  }, [handleReset, open]);

  useEffect(() => {
    if (open && initialData) setForm((current) => ({ ...current, ...initialData }));
  }, [open, initialData]);

  if (!open) return null;

  const selectedOwner = owners.find((owner) => String(owner.owner_id) === String(form.owner_id));

  const setField = (key) => (event) => {
    const nextValue = key === "boat_name" ? event.target.value.toUpperCase() : event.target.value;
    setForm((current) => ({ ...current, [key]: nextValue }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const handleOwnerSelect = (value) => {
    setForm((current) => ({ ...current, owner_id: value ?? "" }));
    setErrors((current) => ({ ...current, owner_id: "" }));
  };

  const handleBoatTypeSelect = (value) => {
    setForm((current) => ({ ...current, boat_type_id: value ?? "" }));
    setErrors((current) => ({ ...current, boat_type_id: "" }));
  };

  const handleImageFile = (file) => {
    if (!file) return;

    if (file.size > MAX_BOAT_IMAGE_SIZE_BYTES) {
      showBottomToast(
        "error",
        "Image Too Large",
        `Boat image must be ${MAX_BOAT_IMAGE_SIZE_KB} KB or less.`
      );
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) =>
      setForm((current) => ({
        ...current,
        image_preview: event.target?.result ?? null,
        image_path: file.name,
      }));
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.boat_name.trim()) nextErrors.boat_name = "Boat name is required.";
    if (!form.boat_type_id) nextErrors.boat_type_id = "Please select a boat type.";
    if (!form.owner_id) nextErrors.owner_id = "Please select an owner.";
    return nextErrors;
  };

  const focusFirstError = (nextErrors) => {
    if (nextErrors.boat_name) {
      boatNameRef.current?.focus();
      boatNameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (nextErrors.boat_type_id) {
      boatTypeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (nextErrors.owner_id) {
      ownerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSubmit = async () => {
    if (isTransactionLocked) {
      showBottomToast("error", "Transactions Locked", transactionLockMessage);
      return;
    }

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await api.post("/boats", {
        boat_name: form.boat_name.trim(),
        boat_type_id: form.boat_type_id,
        owner_id: form.owner_id,
        status: form.status,
      });

      let createdBoat = {
        ...response.data,
        status: response.data?.status ?? form.status,
      };

      addRegisteredBoatToDataCache(queryClient, createdBoat);
      handleReset();
      showAddedToast("Boat", "boat");
      onSuccess?.(createdBoat);
      uploadBoatImageInBackground({
        queryClient,
        boat: createdBoat,
        imageFile,
        onUploaded: onImageUploaded,
      });
    } catch (error) {
      showBottomToast("error", "Registration Failed", error.response?.data?.message ?? "Failed to register boat. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfigProvider theme={BA_antTheme}>
      <style>{`
        .boat-ant-select-dropdown {
          border-radius: 10px !important;
          overflow: hidden !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.13) !important;
          padding: 0 !important;
          z-index: 11000 !important;
        }
        .boat-ant-select-dropdown .ant-select-item {
          border-radius: 0 !important;
          padding: 8px 12px !important;
          font-family: ${BA_FONT} !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #1a1f36 !important;
        }
        .boat-ant-select-dropdown .ant-select-item-option-selected {
          background-color: #1a1f36 !important;
          color: #ffffff !important;
          font-weight: 400 !important;
        }
        .boat-ant-select-dropdown .ant-select-item-option-active:not(.ant-select-item-option-selected) {
          background-color: #f8fafc !important;
        }
        .boat-ant-select-error .ant-select-selector,
        .boat-ant-select-error.ant-select-focused .ant-select-selector,
        .boat-ant-select-error.ant-select-open .ant-select-selector,
        .boat-ant-select-error .ant-select-selector:hover {
          border-color: #fca5a5 !important;
        }
      `}</style>
      <Modal
        title="Add Boat"
        onClose={submitting ? undefined : onClose}
        onCancel={onClose}
        onSave={handleSubmit}
        saving={submitting}
        saveDisabled={submitting || isTransactionLocked || loading}
        saveLabel="Save"
        saveButtonWidth="170px"
        closeButtonWidth="170px"
        maxWidth="980px"
        minimumSavingMs={0}
        closeOnBackdrop
        bodyClassName="max-h-[64vh] overflow-y-auto !p-5"
      >
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card
            icon={IoImageOutline}
            title="BOAT IMAGE"
            subtitle="Upload a photo of the boat."
            loading={loading}
            skeletonLayout={[
              { type: "upload", height: "h-[180px]" },
              { type: "button" },
            ]}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => handleImageFile(event.target.files?.[0])}
              className="hidden"
            />
            {form.image_preview ? (
              <div className="flex flex-col gap-3">
                <div className="relative overflow-hidden rounded-[10px] border border-gray-200 bg-black">
                  <img src={form.image_preview} alt="Boat preview" className="block w-full object-contain" style={{ maxHeight: 280 }} />
                  <div
                    className="absolute left-0 right-0 top-0 flex items-center justify-between px-3 py-2.5"
                    style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
                  >
                    <div />
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setLightbox(true)} className="flex h-7 w-7 items-center justify-center rounded-[10px] border-none bg-white/20 text-white cursor-pointer transition-colors hover:bg-white/35">
                        <IoExpandOutline className="text-[14px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, image_preview: null, image_path: "" }));
                          setImageFile(null);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-[10px] border-none bg-white/20 text-white cursor-pointer transition-colors hover:bg-red-500/70"
                      >
                        <IoCloseOutline className="text-[15px]" />
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-[10px] border border-dashed border-gray-300 bg-[#fafbfc] py-2.5 text-[13px] font-medium text-gray-500 cursor-pointer transition-all hover:border-[#4096ff] hover:bg-blue-50 hover:text-[#4096ff]"
                >
                  Change Image
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleImageFile(event.dataTransfer.files?.[0]);
                }}
                onDragOver={(event) => event.preventDefault()}
                className="flex min-h-[252px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed border-gray-300 bg-[#fafbfc] px-5 py-10 transition-colors hover:border-[#4096ff] hover:bg-blue-50"
              >
                <div className="flex h-[56px] w-[56px] items-center justify-center rounded-[10px] bg-blue-50">
                  <IoCloudUploadOutline className="text-[26px] text-blue-500" />
                </div>
                <p className="m-0 text-center text-[11px] font-semibold uppercase" style={{ color: "#6F6F82" }}>Click to upload boat image</p>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-6">
            <Card
              icon={IoBoatOutline}
              title="BOAT INFORMATION"
              subtitle="Basic details about the boat."
              loading={loading}
              skeletonLayout={[
                { type: "fields", count: 2, columns: 2 },
                { type: "segmented", count: 4, columns: 4 },
              ]}
            >
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <BA_Label required>Boat Name</BA_Label>
                  <BA_Input
                    ref={boatNameRef}
                    placeholder="Enter boat name"
                    value={form.boat_name}
                    onChange={setField("boat_name")}
                    error={Boolean(errors.boat_name)}
                  />
                  <BA_FieldError msg={errors.boat_name} />
                </div>

                <div ref={boatTypeRef}>
                  <BA_Label required>Boat Type</BA_Label>
                  <FilterSelect
                    className={`boat-ant-select ${errors.boat_type_id ? "boat-ant-select-error" : ""}`}
                    popupClassName="boat-ant-select-dropdown"
                    width="100%"
                    height={46}
                    style={{ width: "100%", height: 46, fontFamily: BA_FONT }}
                    placement="bottomLeft"
                    getPopupContainer={() => document.body}
                    showSearch
                    allowClear
                    placeholder="Select boat type"
                    optionFilterProp="searchLabel"
                    value={form.boat_type_id || undefined}
                    onChange={handleBoatTypeSelect}
                    filterOption={(input, option) => (option?.searchLabel ?? "").toLowerCase().includes(input.toLowerCase())}
                    options={boatTypes.map((type) => ({
                      value: type.boat_type_id,
                      label: type.type_name,
                      searchLabel: type.type_name,
                    }))}
                  />
                  <BA_FieldError msg={errors.boat_type_id} />
                </div>
              </div>

              <div>
                <BA_Label>Status</BA_Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {BA_STATUS_OPTIONS.map((option) => {
                    const active = form.status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, status: option.value }))}
                        className={`flex h-[46px] items-center justify-center rounded-[10px] border-2 px-3 text-[11px] font-semibold uppercase cursor-pointer transition-all ${active ? option.active : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50"}`}
                        style={{ fontFamily: BA_FONT }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card
              icon={IoPersonOutline}
              title="OWNER INFORMATION"
              subtitle="Details about the boat owner."
              loading={loading}
              skeletonLayout={[
                { type: "fields", count: 1, columns: 1 },
                { type: "fields", count: 2, columns: 2 },
              ]}
            >
              <div className="mb-4" ref={ownerRef}>
                <BA_Label required>Owner Name</BA_Label>
                {owners.length === 0 ? (
                  <div className="flex h-[46px] items-center rounded-[10px] border border-gray-200 bg-gray-50 px-3.5">
                    <span className="text-[13px] font-medium text-gray-300">No owners available</span>
                  </div>
                ) : (
                  <FilterSelect
                    className={`boat-ant-select ${errors.owner_id ? "boat-ant-select-error" : ""}`}
                    popupClassName="boat-ant-select-dropdown"
                    width="100%"
                    height={46}
                    style={{ width: "100%", height: 46, fontFamily: BA_FONT }}
                    placement="bottomLeft"
                    getPopupContainer={() => document.body}
                    showSearch
                    allowClear
                    placeholder="Select from registered boat owners"
                    optionFilterProp="searchLabel"
                    value={form.owner_id || undefined}
                    onChange={handleOwnerSelect}
                    filterOption={(input, option) => (option?.searchLabel ?? "").toLowerCase().includes(input.toLowerCase())}
                    options={owners.map((owner) => ({
                      value: owner.owner_id,
                      label: BA_getOwnerLabel(owner),
                      searchLabel: BA_getOwnerLabel(owner),
                    }))}
                  />
                )}
                <BA_FieldError msg={errors.owner_id} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <BA_Label>Owner Address</BA_Label>
                  <BA_Input value={selectedOwner?.address ?? ""} readOnly wrapperClassName="!bg-slate-100" />
                </div>
                <div>
                  <BA_Label>Contact Number</BA_Label>
                  <BA_Input value={selectedOwner?.contact_number ?? ""} readOnly wrapperClassName="!bg-slate-100" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Modal>
      {lightbox && form.image_preview ? <BA_Lightbox src={form.image_preview} onClose={() => setLightbox(false)} /> : null}
    </ConfigProvider>
  );
};

const RegisteredBoats = () => {
  const { pathname } = useLocation();
  return <RB_RegisteredBoats openAddBoatOnMount={pathname === "/add-boat"} />;
};

export default RegisteredBoats;
