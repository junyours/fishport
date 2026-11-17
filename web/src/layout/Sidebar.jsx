import React, { useState, useEffect, useId, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "typeface-montserrat";
import "@fontsource/anton";
import {
  IoHomeOutline,
  IoNotificationsOutline,
  IoBoatOutline,
  IoCarOutline,
  IoFishOutline,
  IoCashOutline,
  IoLogOutOutline,
  IoPeopleOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoEllipsisHorizontalOutline,
  IoCalendarOutline,
  IoListOutline,
  IoLayersOutline,
  IoPricetagOutline,
  IoReceiptOutline,
  IoCardOutline,
  IoBarChartOutline,
  IoSettingsOutline,
  IoDocumentTextOutline,
  IoArchiveOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { logoutUser } from "../pages/login/logout";
import { getStoredUser, normalizeRole } from "../pages/login/auth";
import Spinner from "../components/Spinner";
import { useSidebarStore } from "../store/sidebarStore";


const LOGO_SRC = "/images/opol_fish_port.png";
const SIDEBAR_SCROLL_KEY = "superadmin-sidebar-scroll-top";
const MOBILE_BREAKPOINT = 900;

// ── Logout Modal ──────────────────────────────────────────────────────────────
const LogoutModal = ({ onConfirm, onCancel, isLoading }) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="rounded-2xl p-8 flex flex-col items-center gap-5 mx-4 w-full max-w-sm bg-white shadow-2xl">
      <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[#1a1f36]">
        <IoLogOutOutline className="text-3xl text-white" />
      </div>
      <div className="text-center">
        <p className="text-base font-bold mb-1 text-[#1a1f36]">Sign Out</p>
        <p className="text-sm text-gray-500">Are you sure you want to sign out of your account?</p>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl text-sm font-normal bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          style={{ border: "2px solid #1a1f36", color: "#1a1f36", fontFamily: "'Montserrat', sans-serif", opacity: isLoading ? 0.5 : 1 }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-normal bg-[#1a1f36] text-white disabled:cursor-not-allowed disabled:opacity-80"
        >
          {isLoading ? <Spinner size={16} className="text-white" /> : "Sign Out"}
        </button>
      </div>
    </div>
  </div>
);

// ── Collapsible menu item ─────────────────────────────────────────────────────
const CollapseMenuItem = ({ icon: Icon, label, subItems, activeItem, onItemClick, onItemHover, isExpanded, onExpand }) => {
  const submenuId = useId();
  const isAnyChildActive = subItems.some((s) => s.label === activeItem);
  const rememberedOpen = useSidebarStore((state) => state.openGroups[label]);
  const setGroupOpen = useSidebarStore((state) => state.setGroupOpen);
  const open = rememberedOpen ?? isAnyChildActive;

  useEffect(() => {
    if (isAnyChildActive && rememberedOpen === undefined) {
      setGroupOpen(label, true);
    }
  }, [isAnyChildActive, label, rememberedOpen, setGroupOpen]);

  return (
    <div className="my-1">
      <button
        type="button"
        aria-label={isExpanded ? undefined : label}
        aria-expanded={isExpanded && open}
        aria-controls={submenuId}
        onClick={() => {
          if (!isExpanded) onExpand();
          setGroupOpen(label, !isExpanded || !open);
        }}
        className={`w-full flex items-center border-l-4 py-2.5 transition-all duration-150 text-left ${
          isExpanded ? "gap-3 pl-3 pr-4" : "justify-center px-0"
        } ${
          isAnyChildActive
            ? "border-white bg-white/10 text-white font-semibold"
            : "border-transparent bg-transparent text-white/50 font-normal hover:bg-white/[0.06] hover:text-white/80"
        }`}
      >
        <Icon className="text-lg flex-shrink-0" />
        {isExpanded && (
          <>
            <span className="flex-1 whitespace-nowrap overflow-hidden">{label}</span>
            {open ? (
              <IoChevronUpOutline className="text-lg flex-shrink-0" aria-hidden="true" />
            ) : (
              <IoChevronDownOutline className="text-lg flex-shrink-0" aria-hidden="true" />
            )}
          </>
        )}
      </button>

      <div id={submenuId} hidden={!isExpanded || !open}>
        {subItems.map((item) => (
          <MenuItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            isActive={activeItem === item.label}
            isExpanded={isExpanded}
            nested
            onHover={() => onItemHover(item.label)}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </div>
  );
};

// ── Plain menu item ───────────────────────────────────────────────────────────
const MenuItem = ({ icon: Icon, label, isActive, onClick, onHover, isExpanded, nested = false }) => (
  <button
    type="button"
    aria-label={isExpanded ? undefined : label}
    aria-current={isActive ? "page" : undefined}
    onMouseEnter={onHover}
    onClick={onClick}
    className={`w-full flex items-center border-l-4 py-2.5 transition-all duration-150 text-left my-1 ${
      isExpanded ? `gap-3 pr-4 ${nested ? "pl-9" : "pl-3"}` : "justify-center px-0"
    } ${
      isActive
        ? "border-white bg-white/10 text-white font-semibold"
        : "border-transparent bg-transparent text-white/50 font-normal hover:bg-white/[0.06] hover:text-white/80"
    }`}
  >
    <Icon className="text-lg flex-shrink-0" />
    {isExpanded && <span className={nested ? "min-w-0" : "whitespace-nowrap overflow-hidden"}>{label}</span>}
  </button>
);

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({
  activeItem,
  setActiveItem,
  open = true,
  onClose,
  collapsed = false,
  onWidthChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  ));
  const navRef = useRef(null);
  const user = getStoredUser() || {};
  const normalizedRole = normalizeRole(user?.role || user?.role_label);
  const isHead = normalizedRole === "head";

  useEffect(() => {
    if (!collapsed) setHovered(false);
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isExpanded = isMobile || !collapsed || hovered || keyboardFocused;
  const sidebarWidth = isExpanded ? 256 : 72;

  useLayoutEffect(() => {
    if (onWidthChange && open && typeof window !== "undefined" && window.innerWidth >= MOBILE_BREAKPOINT) {
      onWidthChange(sidebarWidth);
    }
  }, [sidebarWidth, open, onWidthChange]);

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement || typeof window === "undefined") return undefined;

    const savedScrollTop = window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    if (savedScrollTop !== null) {
      navElement.scrollTop = Number(savedScrollTop) || 0;
    }

    const handleScroll = () => {
      window.sessionStorage.setItem(
        SIDEBAR_SCROLL_KEY,
        String(navElement.scrollTop),
      );
    };

    navElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => navElement.removeEventListener("scroll", handleScroll);
  }, []);

  const confirmLogout = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      await logoutUser();
      navigate("/login", { replace: true });
    } catch (error) {
      setIsSigningOut(false);
    }
  };

  const navigateIfNeeded = (path) => {
    if (!path) return;
    if (location.pathname === path && !location.search && !location.state) return;
    navigate(path, { replace: location.pathname === path, state: null });
  };

  const activeLabelFromPath = (() => {
    const pathname = location.pathname;
    const boatRegisteredPath = "/registered-boats";
    const boatTypePath = "/boat-type";
    const boatOwnersPath = "/boat-owners";
    const addBoatPath = "/add-boat";
    const dashboardPath = "/dashboard";
    const settingsPath = "/settings";
    const dockingPath = "/docking";
    const dockingCalendarPath = "/docking-calendar";
    const banyeraPath = "/banyera";
    const fishClassificationPath = "/fish-classification";
    const vehicleTicketsPath = "/daily-vehicle-tickets";
    const annualVehicleTicketsPath = "/annual-vehicle-tickets";
    const vehicleTypesPath = "/vehicle-types";
    const billingPath = "/billing";
    const billingPaymentsPath = "/billing-payments";
    const collectionsPath = "/collections";
    const soaPath = "/owner-statement";
    const reportsPath = "/reports";
    const remittancePath = "/remittance";
    const archivesPath = "/archives";

    const pathMap = new Map([
      [dashboardPath, "Dashboard"],
      [boatRegisteredPath, "Registered Boats"],
      [boatTypePath, "Boat Types"],
      [boatOwnersPath, "Boat Owners"],
      [addBoatPath, "Registered Boats"],
      [dockingPath, "Docking"],
      [dockingCalendarPath, "Docking"],
      [banyeraPath, "Banyera"],
      [fishClassificationPath, "Banyera"],
      ["/vehicle-tickets", "Vehicle Tickets"],
      [vehicleTicketsPath, "Vehicle Tickets"],
      [annualVehicleTicketsPath, "Vehicle Tickets"],
      [vehicleTypesPath, "Vehicle Tickets"],
      [billingPath, "Billing"],
      [billingPaymentsPath, "Billing"],
      [collectionsPath, "Collections"],
      ["/payments", "Collections"],
      [soaPath, "Statement of Account"],
      ["/boat-statement", "Statement of Account"],
      ["/statement-of-account", "Statement of Account"],
      [reportsPath, "Reports"],
      [remittancePath, "Collections"],
      ["/notification", "Notification"],
      ["/set-fees", "Set Fees"],
      ["/manage-accounts", "Accounts"],
      [archivesPath, "Archives"],
      ["/activity-logs", "Activity Logs"],
      [settingsPath, "Settings"],
    ]);

    return pathMap.get(pathname) || activeItem;
  })();

  const prefetchForLabel = (label) => {
    return label;
  };

  const handleItemClick = ({ label, path }) => {
    setActiveItem?.(label);
    prefetchForLabel(label);
    navigateIfNeeded(path);
    if (isMobile) onClose?.();
  };

  const sections = [
    {
      label: "GENERAL",
      items: [
        { type: "item", icon: IoHomeOutline, label: "Dashboard", path: "/dashboard" },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          type: "collapse", icon: IoBoatOutline, label: "Boat Management",
          subItems: [
            { icon: IoBoatOutline, label: "Registered Boats", path: "/registered-boats" },
            { icon: IoPeopleOutline, label: "Boat Owners", path: "/boat-owners" },
            { icon: IoLayersOutline, label: "Boat Types", path: "/boat-type" },
          ],
        },
        {
          type: "collapse", icon: IoListOutline, label: "Transaction",
          subItems: [
            { icon: IoCalendarOutline, label: "Docking", path: "/docking" },
            { icon: IoFishOutline, label: "Banyera", path: "/banyera" },
            { icon: IoCarOutline, label: "Vehicle Tickets", path: "/vehicle-tickets" },
          ],
        },
        {
          type: "collapse", icon: IoCardOutline, label: "Finance",
          subItems: [
            { icon: IoReceiptOutline, label: "Billing", path: "/billing" },
            { icon: IoCashOutline, label: "Collections", path: "/collections" },
            { icon: IoDocumentTextOutline, label: "Statement of Account", path: "/owner-statement" },
          ],
        },
        { type: "item", icon: IoPricetagOutline, label: "Set Fees", path: "/set-fees", headOnly: true },
      ],
    },
    {
      label: "Insights",
      items: [
        { type: "item", icon: IoBarChartOutline, label: "Reports", path: "/reports" },
      ],
    },
    {
      label: "More",
      items: [
        {
          type: "collapse", icon: IoEllipsisHorizontalOutline, label: "Others",
          subItems: [
            { icon: IoPeopleOutline, label: "Accounts", path: "/manage-accounts" },
            { icon: IoArchiveOutline, label: "Archives", path: "/archives" },
            { icon: IoNotificationsOutline, label: "Notification", path: "/notification" },
            { icon: IoTimeOutline, label: "Activity Logs", path: "/activity-logs", headOnly: true },
          ],
        },
      ],
    },
  ].map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.headOnly || isHead),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {showLogoutModal && (
        <LogoutModal
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutModal(false)}
          isLoading={isSigningOut}
        />
      )}

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-[55] lg:hidden bg-[#1a1f36]/55 backdrop-blur-[2px]" onClick={onClose} />
      )}

      <aside
        className="fixed left-0 top-0 z-[60] flex h-full flex-col overflow-hidden"
        style={{
          backgroundColor: "#1a1f36",
          fontFamily: "'Montserrat', sans-serif",
          width: `${sidebarWidth}px`,
          transition: "width 0.3s ease, transform 0.3s ease",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
        onMouseEnter={() => { if (collapsed) setHovered(true);  }}
        onMouseLeave={() => { if (collapsed) setHovered(false); }}
        onFocusCapture={(event) => {
          if (event.target.matches(":focus-visible")) setKeyboardFocused(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false);
        }}
      >
        {/* Logo + Title */}
        <div className="flex items-center pt-5 pb-3 px-4 gap-1 overflow-hidden">
          {/* ── Logo image replaces the old IoBoatOutline icon ── */}
          <div className="h-11 w-11 min-h-[45px] min-w-[47px] flex-none overflow-hidden flex items-center justify-center">
            <img
              src={LOGO_SRC}
              alt="Opol Fish Port Logo"
              className="h-full w-full object-contain scale-120"
            />
          </div>

          <div
            className="flex flex-col leading-tight"
            style={{
              opacity: isExpanded ? 1 : 0,
              transform: isExpanded ? "translateX(0)" : "translateX(-8px)",
              transition: "opacity 0.3s ease, transform 0.3s ease",
              pointerEvents: isExpanded ? "auto" : "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: "15px",
                letterSpacing: "0.04em",
                lineHeight: 1.1,
              }}
            >
              <span className="text-white/80">Opol Fish</span>
              <span style={{ color: "#3b82f6" }}> Port</span>
            </span>
            <span
              className="text-white/80 font-light"
              style={{
                fontSize: "9.3px",
                letterSpacing: "0.21em",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Management System
            </span>
          </div>

        </div>

        {/* Menu */}
        <nav
          ref={navRef}
          className={`flex-1 text-sm overflow-y-auto pb-2 pt-0 ${!isExpanded ? "px-2" : "px-3"}`}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {sections.map((section) => (
            <div key={section.label}>
              {isExpanded ? (
                <p
                  className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  {section.label}
                </p>
              ) : (
                <p
                  className="text-center pt-4 pb-1 text-[11px] font-bold"
                  style={{ color: "rgba(255,255,255,0.2)" }}
                >
                  ···
                </p>
              )}

              {section.items.map((item) => {
                if (item.type === "collapse") {
                  return (
                    <CollapseMenuItem
                      key={item.label}
                      icon={item.icon}
                      label={item.label}
                      subItems={item.subItems.filter((subItem) => !subItem.headOnly || isHead)}
                      activeItem={activeLabelFromPath}
                      onItemClick={handleItemClick}
                      onItemHover={prefetchForLabel}
                      isExpanded={isExpanded}
                      onExpand={() => setHovered(true)}
                    />
                  );
                }
                return (
                  <MenuItem
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    isActive={activeLabelFromPath === item.label}
                    isExpanded={isExpanded}
                    onHover={() => prefetchForLabel(item.label)}
                    onClick={() => handleItemClick(item)}
                  />
                );
              })}
            </div>
          ))}

          {/* System section */}
          <div>
            {isExpanded ? (
              <p
                className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                System
              </p>
            ) : (
              <p
                className="text-center pt-4 pb-1 text-[11px] font-bold"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                ···
              </p>
            )}

            <MenuItem
              icon={IoSettingsOutline}
              label="Settings"
              isActive={activeLabelFromPath === "Settings"}
              isExpanded={isExpanded}
              onClick={() => {
                navigateIfNeeded("/settings");
                if (isMobile) onClose?.();
              }}
            />

            <button
              onClick={() => setShowLogoutModal(true)}
              className={`w-full flex items-center gap-3 py-2.5 rounded-[10px] text-sm transition-all duration-150 text-white/50 hover:bg-white/[0.06] hover:text-white/80 mb-4 ${
                !isExpanded ? "justify-center px-0" : "px-4"
              }`}
            >
              <IoLogOutOutline className="text-lg flex-shrink-0" />
              {isExpanded && <span className="whitespace-nowrap">Sign out</span>}
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
