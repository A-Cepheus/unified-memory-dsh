import type { Context } from '@deepseek-ai/cordis';
import type { ComponentType, ReactNode } from 'react';

export type ClientTranslateFn = (
  key: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) => string;

export interface DshLocaleSnapshot {
  readonly active: string;
  readonly revision: number;
}

export interface DshLocaleRuntime {
  getLocale(): DshLocaleSnapshot;
  getSnapshot(): DshLocaleSnapshot;
  subscribe(listener: () => void): () => void;
  setLocale(id: string): void;
  register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): () => void;
  bind(ns: string): ClientTranslateFn;
}

export interface DshLayoutController {
  selectPanel(id: string): void;
  toggleSidebar?(): void;
  panelInfo?: {
    getSnapshot(): { readonly activePanelId: string | null };
    subscribe(listener: () => void): () => void;
  };
}

export interface DshSlotRegisterOptions {
  readonly name: string;
  readonly id?: string;
  readonly key?: string;
  readonly order?: number;
  readonly label?: string | (() => string);
  readonly locale?: string;
  readonly inject?: (...args: unknown[]) => Record<string, unknown>;
}

export interface DshSlotRegistry {
  register(options: DshSlotRegisterOptions, component: ComponentType<any>): () => void;
  inject(key: string, callback: () => (() => void) | Iterable<() => void>): () => void;
}

export interface DshIconProps {
  readonly size?: number;
  readonly className?: string;
  readonly active?: boolean;
}

export interface DshSidebarRightGuideEntry {
  readonly id: string;
  readonly order: number;
  readonly title: () => string;
  readonly description?: () => string;
  readonly icon?: ComponentType<DshIconProps>;
}

export interface DshSidebarRightTabDefinition {
  readonly id: string;
  readonly kind: string;
  readonly multiple?: boolean;
  readonly keepMounted?: boolean;
  readonly priority?: 'extension' | 'builtin' | 'fallback';
  readonly title: (address: string) => string;
  readonly guide?: readonly DshSidebarRightGuideEntry[];
}

export interface DshSidebarRightTabRegistry {
  register(definition: DshSidebarRightTabDefinition): () => void;
}

export interface DshSessionSummaryLike {
  readonly id: string;
  readonly cwd?: string;
  readonly title?: string;
  readonly running?: boolean;
  readonly retainedBy?: Record<string, number | undefined>;
}

export interface DshSessionListStateLike {
  readonly ids?: readonly string[];
  readonly byId: Record<string, DshSessionSummaryLike | undefined>;
}

export type DshUseSessionsHook = <Selected>(
  selector: (state: DshSessionListStateLike) => Selected,
) => Selected;

export interface DshSidebarRightTabActions {
  bindCommands(commands: { readonly refresh?: () => void }): () => void;
  openTab?(kind: string, options?: Record<string, unknown>): void;
  close?(): void;
}

export interface DshSidebarRightTabInfo {
  readonly sidebar: {
    readonly expanded: boolean;
    readonly fullscreen: boolean;
  };
  readonly panel: {
    readonly id: string;
    readonly isFloating: boolean;
  };
  readonly tab: {
    readonly id: string;
    readonly kind: string;
    readonly title: string;
    readonly visible: boolean;
    readonly actions: DshSidebarRightTabActions;
  };
}

export type DshUseSidebarRightTabInfo = () => DshSidebarRightTabInfo;

export interface DshClientContext extends Context {
  slots: DshSlotRegistry;
  locale: DshLocaleRuntime;
  layout: DshLayoutController;
  sidebarRightTabs?: DshSidebarRightTabRegistry;
}

export interface MainSlotRuntimeProps {
  readonly t?: ClientTranslateFn;
  readonly useSessions?: DshUseSessionsHook;
  readonly getActiveLocale?: () => string;
}

export interface RightTabSlotRuntimeProps {
  readonly sessionId?: string;
  readonly t?: ClientTranslateFn;
  readonly useSessions?: DshUseSessionsHook;
  readonly useTabInfo?: DshUseSidebarRightTabInfo;
  readonly openGlobalConsole?: () => void;
}

export interface RightTabTitleSlotRuntimeProps {
  readonly t?: ClientTranslateFn;
  readonly useTabInfo?: DshUseSidebarRightTabInfo;
}

export type PanelIconProps = {
  readonly size: number;
  readonly active?: boolean;
};

export type RenderableNode = ReactNode;
