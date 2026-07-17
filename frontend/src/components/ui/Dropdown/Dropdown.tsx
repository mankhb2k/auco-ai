import { ChevronRight, Check } from "lucide-react";
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface DropdownContentProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export const DropdownContent: React.FC<DropdownContentProps> = ({
  isOpen,
  onClose,
  children,
  align = "right",
  className = "",
}) => {
  if (!isOpen) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-transparent cursor-default"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      ></div>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-[calc(100%+6px)] ${
          align === "right"
            ? "right-0 origin-top-right"
            : "left-0 origin-top-left"
        } z-50 w-max overflow-visible bg-white/95 backdrop-blur-md rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100/30 p-1 text-gray-600 text-left font-medium animate-in fade-in zoom-in-95 duration-100 select-none ${className}`}
      >
        {children}
      </div>
    </>
  );
};

export interface DropdownItemProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  onClick?: () => void;
  className?: string;
  danger?: boolean;
  checked?: boolean;
  rightElement?: React.ReactNode;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  icon,
  label,
  onClick,
  className = "",
  danger = false,
  checked = false,
  rightElement,
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full pl-3 pr-1.5 py-2 flex items-center justify-between rounded-lg transition-all cursor-pointer border-none bg-transparent text-left font-medium ${
        danger
          ? "hover:bg-red-50 active:bg-red-100 text-red-500"
          : "hover:bg-black/5 active:bg-black/10 text-gray-700"
      } ${className}`}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-8">
        {icon && (
          <span
            className={`${danger ? "text-red-500" : "text-gray-500"} [&>svg]:stroke-[2] flex-shrink-0`}
          >
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      {rightElement ? (
        <span className="text-gray-400 flex-shrink-0 flex items-center justify-center [&>svg]:stroke-[2]">
          {rightElement}
        </span>
      ) : (
        <span
          className={`text-[#3390ec] flex-shrink-0 flex items-center justify-center ${
            checked ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Check size={16} className="stroke-[2.5]" />
        </span>
      )}
    </button>
  );
};

export const DropdownSeparator = () => (
  <div className="h-px bg-gray-100 my-1.5 mx-1"></div>
);

interface DropdownSubContextProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  scheduleClose: () => void;
  cancelClose: () => void;
}

const DropdownSubContext = createContext<DropdownSubContextProps | undefined>(
  undefined,
);

const useDropdownSub = () => {
  const context = useContext(DropdownSubContext);
  if (!context) {
    throw new Error(
      "DropdownSub components must be rendered within a <DropdownSub /> provider",
    );
  }
  return context;
};

/** Submenu — portal ra body để không bị parent `overflow` cắt. */
export const DropdownSub: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 120);
  };

  return (
    <DropdownSubContext.Provider
      value={{ isOpen, setIsOpen, triggerRef, scheduleClose, cancelClose }}
    >
      <div
        ref={triggerRef}
        className="relative w-full"
        onMouseEnter={() => {
          cancelClose();
          setIsOpen(true);
        }}
        onMouseLeave={scheduleClose}
      >
        {children}
      </div>
    </DropdownSubContext.Provider>
  );
};

export type DropdownSubTriggerProps = DropdownItemProps;

export const DropdownSubTrigger: React.FC<DropdownSubTriggerProps> = ({
  icon,
  label,
  className = "",
  onClick,
}) => {
  const { isOpen, setIsOpen, cancelClose } = useDropdownSub();

  return (
    <DropdownItem
      icon={icon}
      label={label}
      rightElement={<ChevronRight size={16} className="text-gray-400" />}
      onClick={
        onClick
          ? () => {
              onClick();
              setIsOpen(!isOpen);
            }
          : () => {
              cancelClose();
              setIsOpen(!isOpen);
            }
      }
      className={className}
    />
  );
};

export interface DropdownSubContentProps {
  children: React.ReactNode;
  className?: string;
}

export const DropdownSubContent: React.FC<DropdownSubContentProps> = ({
  children,
  className = "",
}) => {
  const { isOpen, triggerRef, cancelClose, scheduleClose } = useDropdownSub();
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setCoords(null);
      return undefined;
    }
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setCoords({ top: rect.top - 4, left: rect.right - 4 });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, triggerRef]);

  if (!isOpen || !coords || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed z-[70] w-max bg-white/95 backdrop-blur-md rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100/30 p-1 text-gray-600 text-left font-medium animate-in fade-in zoom-in-95 duration-100 select-none ${className}`}
      style={{ top: coords.top, left: coords.left }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
};
