"use client";

import "./paper-mindmap.css";
import { PaperIcon } from "./paper-icon";
import { installTouchContextMenu } from '@/lib/touch-context-menu';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { type MindElixirInstance, type MindElixirData, type NodeObj, type Options, type Theme as MindElixirTheme, SIDE } from "mind-elixir";
import { snapdom } from "@zumer/snapdom";

// Check document class for theme (works with next-themes, etc.)
function getDocumentTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  return null;
}

// Get system preference
function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function useResolvedTheme(themeProp?: "light" | "dark"): "light" | "dark" {
  const [detectedTheme, setDetectedTheme] = useState<"light" | "dark">(
    () => getDocumentTheme() ?? getSystemTheme(),
  );

  useEffect(() => {
    if (themeProp) return; // Skip detection if theme is provided via prop

    // Watch for document class changes (e.g., next-themes toggling dark class)
    const observer = new MutationObserver(() => {
      const docTheme = getDocumentTheme();
      if (docTheme) {
        setDetectedTheme(docTheme);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also watch for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      // Only use system preference if no document class is set
      if (!getDocumentTheme()) {
        setDetectedTheme(e.matches ? "dark" : "light");
      }
    };
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [themeProp]);

  return themeProp ?? detectedTheme;
}

type Theme = "light" | "dark";
type Arrow = MindElixirInstance["arrows"][number];
function cardNodeFromTarget(target: EventTarget | null) {
  const node = target instanceof Element ? (target.closest('me-tpc') as (HTMLElement & { nodeObj?: NodeObj }) | null)?.nodeObj : undefined;
  return (node?.metadata as { kind?: string } | undefined)?.kind === 'card-link' ? node : undefined;
}

// Context for MindMap
interface MindMapContextValue {
  mind: MindElixirInstance | null;
  isLoaded: boolean;
}

const MindMapContext = createContext<MindMapContextValue | null>(null);

function fitPaperMap(mind: MindElixirInstance) {
  mind.scaleFit();
  // Keep mobile labels readable; the surrounding branches remain pannable.
  if (mind.container.clientWidth < 640 && mind.scaleVal < 0.65) {
    mind.scale(0.65);
    mind.toCenter();
  }
}

export function useMindMap() {
  const context = useContext(MindMapContext);
  if (!context) {
    throw new Error("useMindMap must be used within a MindMap component");
  }
  return context;
}

// MindMap Props
type MindMapData = MindElixirData;

// Ref type to expose MindElixir instance to parent components
export interface MindMapRef {
  instance: MindElixirInstance | null;
}

interface MindMapProps {
  children?: ReactNode;
  data?: MindMapData;
  className?: string;
  direction?: 0 | 1 | 2;
  contextMenu?: boolean;
  nodeMenu?: boolean;
  keypress?: boolean;
  locale?: "en" | "zh_CN" | "zh_TW" | "ja" | "pt";
  overflowHidden?: boolean;
  mainLinkStyle?: number;
  theme?: "dark" | "light";
  monochrome?: boolean;
  fit?: boolean;
  readonly?: boolean;
  onChange?: (data: MindMapData, operation: unknown) => void;
  onOperation?: (operation: unknown) => void;
  onSelectNodes?: (nodeObj: NodeObj[]) => void;
  onSelectArrow?: (arrow: Arrow | null) => void;
  onOpenImage?: (node: NodeObj) => void;
  onOpenCard?: (node: NodeObj) => void;
  loader?: ReactNode;
}

function DefaultLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <PaperIcon name="pencil" className="size-8 animate-pulse" />
    </div>
  );
}

// Common spacing and layout configuration
const commonSpacing = {
  "--node-gap-x": "48px",
  "--node-gap-y": "16px",
  "--main-gap-x": "24px",
  "--main-gap-y": "32px",
  "--root-radius": "0.625rem",
  "--main-radius": "0.5rem",
  "--topic-padding": "8px 16px",
  "--map-padding": "48px",
};

// Helper function to create theme
function createTheme(
  name: string,
  type: "light" | "dark",
  colors: {
    mainColor: string;
    mainBgcolor: string;
    color: string;
    bgcolor: string;
    selected: string;
    accentColor: string;
    rootColor: string;
    rootBgcolor: string;
    rootBorderColor: string;
    panelColor: string;
    panelBgcolor: string;
    panelBorderColor: string;
  },
  palette: string[]
): MindElixirTheme {
  return {
    name,
    type,
    palette,
    cssVar: {
      ...commonSpacing,
      "--main-color": colors.mainColor,
      "--main-bgcolor": colors.mainBgcolor,
      "--main-bgcolor-transparent": `${colors.mainBgcolor.replace(")", " / 95%)")}`,
      "--color": colors.color,
      "--bgcolor": colors.bgcolor,
      "--selected": colors.selected,
      "--accent-color": colors.accentColor,
      "--root-color": colors.rootColor,
      "--root-bgcolor": colors.rootBgcolor,
      "--root-border-color": colors.rootBorderColor,
      "--panel-color": colors.panelColor,
      "--panel-bgcolor": colors.panelBgcolor,
      "--panel-border-color": colors.panelBorderColor,
    },
  };
}

// The notebook palette stays consistent with the selected paper references.
function getTheme(isDark: boolean, isMonochrome: boolean): MindElixirTheme {
  return createTheme("paper-notebook", isDark ? "dark" : "light", {
    mainColor: "#352C28", mainBgcolor: "#C9DDF5",
    color: "#352C28", bgcolor: "#F2EFE0",
    selected: "#B9210C", accentColor: "#B9210C",
    rootColor: "#F2EFE0", rootBgcolor: "#B9210C",
    rootBorderColor: "#B9210C", panelColor: "#352C28",
    panelBgcolor: "#F2EFE0", panelBorderColor: "#958778",
  }, isMonochrome ? ["#B9210C"] : ["#7896B3", "#B79243", "#B9210C"]);
}

export const MindMap = forwardRef<MindMapRef, MindMapProps>(function MindMap({
  children,
  data,
  className,
  direction = SIDE,
  contextMenu = true,
  nodeMenu = true,
  keypress = true,
  locale = "en",
  overflowHidden = false,
  mainLinkStyle = 2,
  theme: themeProp,
  monochrome = false,
  fit = true,
  readonly = false,
  onChange,
  onOperation,
  onSelectNodes,
  onSelectArrow,
  onOpenImage,
  onOpenCard,
  loader,
}: MindMapProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardTouch = useRef<{ node: NodeObj; x: number; y: number; at: number; pointerId: number } | null>(null);
  const lastCardTouch = useRef({ id: '', at: -1000 });
  const suppressContextClick = useRef(false);
  const mindRef = useRef<MindElixirInstance | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mindInstance, setMindInstance] = useState<MindElixirInstance | null>(
    null,
  );
  const [isMounted, setIsMounted] = useState(false);
  const resolvedTheme = useResolvedTheme(themeProp);
  const id = useId();
  
  // Expose mind instance to parent component via ref
  // We need mindInstance as a dependency to ensure the ref is updated after async initialization
  useImperativeHandle(ref, () => ({
    instance: mindRef.current,
  }));
  
  // Store resolvedTheme in a ref for use in effects without triggering re-runs
  const resolvedThemeRef = useRef(resolvedTheme);
  useEffect(() => {
    resolvedThemeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  // Store callbacks in refs to avoid re-initialization when they change
  const onChangeRef = useRef(onChange);
  const onOperationRef = useRef(onOperation);
  const onSelectNodesRef = useRef(onSelectNodes);
  const onSelectArrowRef = useRef(onSelectArrow);
  
  useEffect(() => {
    onChangeRef.current = onChange;
    onOperationRef.current = onOperation;
    onSelectNodesRef.current = onSelectNodes;
    onSelectArrowRef.current = onSelectArrow;
  }, [onChange, onOperation, onSelectNodes, onSelectArrow]);

  // Store initial data in ref - only used for initialization, not reactive
  const initialDataRef = useRef(data);

  // Ensure component only renders on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize MindElixir (client-side only)
  useEffect(() => {
    if (!isMounted || !containerRef.current || mindRef.current) return;

    let isSubscribed = true;
    let stopTouchMenu = () => {};

    // Dynamic import to avoid SSR issues
    import("mind-elixir").then(async (MindElixirModule) => {
      await document.fonts.load('16px "Notebook Chinese"').catch(() => []);
      if (!isSubscribed || !containerRef.current) return;

      const MindElixir = MindElixirModule.default;

      const options = {
        el: containerRef.current,
        direction,
        contextMenu,
        toolBar: false,
        nodeMenu,
        keypress,
        locale,
        overflowHidden,
        mainLinkStyle,
        editable: !readonly,
        alignment: "nodes",
        theme:
          getTheme(resolvedThemeRef.current === "dark", monochrome),
      } as Options;

      try {
        const mind = new MindElixir(options);

        // Initialize with initial data from ref (not reactive to data prop changes)
        const initialData = initialDataRef.current || MindElixir.new("Mind Map");
        mind.init(initialData);
        if (contextMenu && !readonly) stopTouchMenu = installTouchContextMenu(mind, () => { suppressContextClick.current = true; cardTouch.current = null; });
        // Keep native curve geometry and hit targets; relationships have no arrowheads.
        const decorateRelations = () => {
          for (const topic of Array.from(mind.nodes.querySelectorAll('me-tpc'))) {
            const node = (topic as HTMLElement & { nodeObj?: NodeObj<{ imageAttachment?: unknown }> }).nodeObj;
            const icon = topic.querySelector('img');
            if (node?.metadata?.imageAttachment && icon) { icon.setAttribute('role', 'button'); icon.setAttribute('aria-label', '查看节点图片'); icon.setAttribute('tabindex', '0'); icon.setAttribute('alt', '查看节点图片'); }
            const cardId = (node?.metadata as { kind?: string; cardId?: string } | undefined)?.kind === 'card-link' && (node?.metadata as { cardId?: string }).cardId;
            if (cardId) { topic.classList.add('card-link-node'); topic.setAttribute('role', 'button'); topic.setAttribute('aria-label', '打开题目卡片'); topic.setAttribute('tabindex', '0'); topic.setAttribute('data-card-id', cardId); }
          }
          for (const group of Array.from(mind.arrowSvg.children)) {
            const arrow = (group as unknown as { arrowObj?: Arrow & { metadata?: { kind?: string } } }).arrowObj;
            if (arrow?.metadata?.kind === 'knowledge-relation') {
              group.classList.add('knowledge-relation');
              const element = group as unknown as { arrow1: SVGPathElement; arrow2: SVGPathElement };
              element.arrow1.style.display = element.arrow2.style.display = 'none';
              const paths = group.querySelectorAll(':scope > path');
              // The native renderer alternates wide hit paths with visible paths.
              for (let i = 2; i < paths.length; i++) (paths[i] as SVGPathElement).style.display = 'none';
            }
          }
        };
        decorateRelations();
        mind.bus.addListener('linkDiv', decorateRelations);
        mind.bus.addListener('selectArrow', arrow => onSelectArrowRef.current?.(arrow));
        mind.bus.addListener('unselectArrow', () => onSelectArrowRef.current?.(null));
        mind.bus.addListener('unselectNodes', () => onSelectNodesRef.current?.([]));

        if (isSubscribed) {
          mindRef.current = mind;
          setMindInstance(mind);
          setIsLoaded(true);

          // Auto-fit if enabled
          if (fit) {
            fitPaperMap(mind);
          }

          // Event listeners (using refs to avoid re-initialization)
          mind.bus.addListener("operation", (operation) => {
            decorateRelations();
            if (operation.name === 'createArrow') onSelectArrowRef.current?.(mind.currentArrow?.arrowObj || null);
            if (operation.name === 'removeArrow') onSelectArrowRef.current?.(null);

            // Call onOperation if provided
            if (onOperationRef.current) {
              onOperationRef.current(operation);
            }
            // Call onChange if provided
            if (onChangeRef.current) {
              const updatedData = mind.getData();
              // Mark this as an internal change to prevent refresh loop
              isInternalChangeRef.current = true;
              onChangeRef.current(updatedData, operation);
            }
          });
          
          if (onSelectNodesRef.current) {
            mind.bus.addListener("selectNodes", (nodeObj) => {
              onSelectNodesRef.current?.(nodeObj);
            });
          }
        }
      } catch (error) {
        console.error("Failed to initialize MindElixir:", error);
      }
    });

    return () => {
      isSubscribed = false;
      stopTouchMenu();
      mindRef.current?.destroy();
      mindRef.current = null;
    };
  }, [
    isMounted,
    direction,
    contextMenu,
    nodeMenu,
    keypress,
    locale,
    overflowHidden,
    mainLinkStyle,
    monochrome,
    readonly,
    fit,
  ]);

  // Track internal changes to avoid refresh loops
  const isInternalChangeRef = useRef(false);
  
  // Update data when it changes
  useEffect(() => {
    if (mindRef.current && data && isLoaded) {
      // Skip refresh if this change came from onChange (internal change)
      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false;
        return;
      }
      mindRef.current.refresh(data);
    }
  }, [data, isLoaded]);

  // Update theme when resolvedTheme or monochrome changes
  useEffect(() => {
    if (!mindRef.current || !isLoaded) return;

    const newTheme = getTheme(resolvedTheme === "dark", monochrome);
    mindRef.current.changeTheme(newTheme);
  }, [resolvedTheme, monochrome, isLoaded]);

  return (
    <MindMapContext.Provider value={{ mind: mindInstance, isLoaded }}>
      <div className={cn("paper-mindmap relative w-full h-full", className)} onPointerDownCapture={event => {
        suppressContextClick.current = false;
        const card = cardNodeFromTarget(event.target);
        cardTouch.current = event.pointerType === 'touch' && event.isPrimary && card ? { node: card, x: event.clientX, y: event.clientY, at: performance.now(), pointerId: event.pointerId } : null;
      }} onPointerUpCapture={event => {
        const touch = cardTouch.current; cardTouch.current = null;
        if (!touch || touch.pointerId !== event.pointerId || !onOpenCard || mindRef.current?.container.querySelector('.tips') || performance.now() - touch.at > 600 || Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) return;
        event.preventDefault(); lastCardTouch.current = { id: touch.node.id, at: performance.now() }; onOpenCard(touch.node);
      }} onPointerCancelCapture={() => { cardTouch.current = null; }} onClickCapture={event => {
        if (suppressContextClick.current) { event.stopPropagation(); event.preventDefault(); return; }
        const card = cardNodeFromTarget(event.target);
        if (card && mindRef.current?.container.querySelector('.tips')) return;
        if (card && onOpenCard) { event.stopPropagation(); event.preventDefault(); if (lastCardTouch.current.id !== card.id || performance.now() - lastCardTouch.current.at > 700) onOpenCard(card); return; }
        const icon = (event.target as Element).closest('img[role="button"]');
        const node = (icon?.closest('me-tpc') as (HTMLElement & { nodeObj?: NodeObj }) | null)?.nodeObj;
        if (node && onOpenImage) { event.stopPropagation(); event.preventDefault(); onOpenImage(node); }
      }} onKeyDownCapture={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const card = cardNodeFromTarget(event.target);
        if (card && onOpenCard) { event.stopPropagation(); event.preventDefault(); onOpenCard(card); return; }
        const icon = (event.target as Element).closest('img[role="button"]');
        const node = (icon?.closest('me-tpc') as (HTMLElement & { nodeObj?: NodeObj }) | null)?.nodeObj;
        if (node && onOpenImage) { event.stopPropagation(); event.preventDefault(); onOpenImage(node); }
      }}>
        <div
          key={id}
          ref={containerRef}
          id={`mindmap-${id}`}
          className="paper-map-canvas w-full h-full overflow-hidden"
        />
        {!isMounted || !isLoaded ? loader || <DefaultLoader /> : null}
        {children}
      </div>
    </MindMapContext.Provider>
  );
});

// MindMap Controls
interface MindMapControlsProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  showZoom?: boolean;
  showFit?: boolean;
  showExport?: boolean;
  className?: string;
  onExport?: (type: "png" | "svg" | "json") => void;
}

export function MindMapControls({
  position = "top-right",
  showZoom = true,
  showFit = true,
  showExport = true,
  className,
  onExport,
}: MindMapControlsProps) {
  const { mind, isLoaded } = useMindMap();
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleZoomIn = () => {
    if (mind) {
      const currentScale = mind.scaleVal || 1;
      mind.scale(currentScale + 0.2);
    }
  };

  const handleZoomOut = () => {
    if (mind) {
      const currentScale = mind.scaleVal || 1;
      mind.scale(Math.max(0.2, currentScale - 0.2));
    }
  };

  const handleFit = () => {
    if (mind) {
      fitPaperMap(mind);
    }
  };

  const handleExport = async () => {
    if (mind) {
      try {
        // Export as image using snapdom
        const result = await snapdom(mind.nodes);
        await result.download({ type: "jpg", filename: "mindmap" });
        
        if (onExport) {
          onExport("png");
        }
      } catch (error) {
        console.error("Failed to export mind map:", error);
      }
    }
  };

  const handleFullscreen = () => {
    const container = mind?.container?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Failed to enter fullscreen:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      // When exiting fullscreen, call scaleFit to ensure content is visible
      if (!isNowFullscreen && mind) {
        fitPaperMap(mind);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [mind]);

  if (!mounted || !isLoaded) return null;

  const positionClasses = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "bottom-right": "bottom-3 right-3",
  };

  return (
    <div
      className={cn(
        "paper-map-controls absolute z-10 flex flex-col gap-1",
        positionClasses[position],
        className,
      )}
    >
      {showZoom && (
        <>
          <button
            onClick={handleZoomIn}
            className="size-8 rounded-md bg-background/95 backdrop-blur-md border border-border/50 shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Zoom in"
          >
            <PaperIcon name="plus" className="size-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="size-8 rounded-md bg-background/95 backdrop-blur-md border border-border/50 shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Zoom out"
          >
            <PaperIcon name="minus" className="size-5" />
          </button>
        </>
      )}
      {showFit && (
        <button
          onClick={handleFit}
          className="size-8 rounded-md bg-background/95 backdrop-blur-md border border-border/50 shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="Fit to screen"
        >
          <PaperIcon name="maximize" className="size-5" />
        </button>
      )}
      <button
        onClick={handleFullscreen}
        className="size-8 rounded-md bg-background/95 backdrop-blur-md border border-border/50 shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        <PaperIcon name="maximize" className="size-5" />
      </button>
      {showExport && (
        <button
          onClick={handleExport}
          className="size-8 rounded-md bg-background/95 backdrop-blur-md border border-border/50 shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="Download as image"
        >
          <PaperIcon name="download" className="size-5" />
        </button>
      )}
    </div>
  );
}

// Export components
