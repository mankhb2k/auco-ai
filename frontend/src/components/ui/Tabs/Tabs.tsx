import React, { createContext, useContext, useRef, useEffect, useState, useCallback } from "react";

interface TabsContextProps {
  value: string;
  onValueChange: (value: string) => void;
  variant?: "capsule" | "pills";
}

const TabsContext = createContext<TabsContextProps | undefined>(undefined);

export const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be rendered within a <Tabs /> provider");
  }
  return context;
};

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  variant?: "capsule" | "pills";
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  variant = "capsule",
  children,
  className = "",
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange, variant }}>
      <div className={`w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Capsule — px tuyệt đối (tránh rem: p-1 → 3.75px khi root 15px):
 * - track: 40px
 * - pad:   4px
 * - pill:  32px  → 4 + 32 + 4 = 40
 */
export const TabsList: React.FC<TabsListProps> = ({
  children,
  className = "",
}) => {
  const { value, variant } = useTabs();
  const containerRef = useRef<HTMLDivElement>(null);
  const [backdropStyle, setBackdropStyle] = useState({ left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  const updateBackdrop = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeEl = container.querySelector("[data-state='active']");
    if (!(activeEl instanceof HTMLElement)) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    setBackdropStyle({
      left: activeRect.left - containerRect.left + container.scrollLeft,
      width: activeRect.width,
    });
  }, []);

  useEffect(() => {
    updateBackdrop();
    if (!mounted) {
      const timer = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [value, mounted, updateBackdrop]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    window.addEventListener("resize", updateBackdrop);
    const resizeObserver = new ResizeObserver(() => updateBackdrop());
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener("resize", updateBackdrop);
      resizeObserver.disconnect();
    };
  }, [updateBackdrop]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeEl = container.querySelector("[data-state='active']");
    if (!(activeEl instanceof HTMLElement)) return;

    const containerWidth = container.clientWidth;
    const activeLeft = activeEl.offsetLeft;
    const activeWidth = activeEl.clientWidth;
    const targetScrollLeft = activeLeft - containerWidth / 2 + activeWidth / 2;
    container.scrollTo({
      left: targetScrollLeft,
      behavior: "smooth",
    });
  }, [value]);

  const isCapsule = variant === "capsule";

  const containerClasses = isCapsule
    ? "relative flex h-[40px] items-center gap-0.5 overflow-x-auto overflow-y-hidden p-[4px] scrollbar-none"
    : "relative flex items-center gap-2 overflow-x-auto overflow-y-hidden py-[4px] scrollbar-none";

  const wrapperClasses = isCapsule
    ? "relative h-[40px] overflow-hidden rounded-full bg-white shadow-sm"
    : "relative";

  return (
    <div className={wrapperClasses}>
      <div ref={containerRef} className={`${containerClasses} ${className}`}>
        {backdropStyle.width > 0 && (
          <div
            className={`pointer-events-none absolute z-10 rounded-full bg-blue-light ${
              isCapsule ? "top-[4px] bottom-[4px]" : "top-[4px] bottom-[4px]"
            } ${mounted ? "transition-all duration-200 ease-out" : ""}`}
            style={{
              left: `${backdropStyle.left}px`,
              width: `${backdropStyle.width}px`,
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
};

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value: triggerValue,
  children,
  className = "",
}) => {
  const { value, onValueChange, variant } = useTabs();
  const isActive = value === triggerValue;

  const getTriggerClasses = () => {
    if (variant === "capsule") {
      return `relative z-20 inline-flex h-[32px] items-center justify-center whitespace-nowrap rounded-full px-4 text-md font-semibold leading-none cursor-pointer transition-colors ${
        isActive ? "text-blue" : "text-gray-400 hover:text-gray-700"
      }`;
    }
    return `relative z-20 inline-flex h-[32px] items-center justify-center whitespace-nowrap rounded-full px-3.5 text-md font-semibold leading-none cursor-pointer transition-all ${
      isActive ? "text-blue" : "text-gray-500 hover:bg-gray-100"
    }`;
  };

  return (
    <button
      type="button"
      data-state={isActive ? "active" : "inactive"}
      onClick={() => onValueChange(triggerValue)}
      className={`${getTriggerClasses()} ${className}`}
    >
      {children}
    </button>
  );
};

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value: contentValue,
  children,
  className = "",
}) => {
  const { value } = useTabs();
  if (value !== contentValue) return null;
  return <div className={className}>{children}</div>;
};
