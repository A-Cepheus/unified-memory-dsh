import type { ReactElement } from 'react';
import type { DshIconProps, PanelIconProps } from './dsh-types.js';

/**
 * Clean geometric memory-layers icon for the Left Sidebar nav item,
 * Right Sidebar Guide card, and tab title chip.
 */
export function MemoryGlyph({
  size = 16,
  className,
}: {
  readonly size?: number;
  readonly className?: string;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  );
}

/** Left Sidebar (`sidebar.panellist`) icon registrant. */
export function MemoryPanelIcon({ size }: PanelIconProps): ReactElement {
  return <MemoryGlyph size={size} />;
}

/** Right Sidebar guide card icon registrant. */
export function MemoryGuideIcon({ size = 22, className }: DshIconProps): ReactElement {
  return <MemoryGlyph size={size} className={className} />;
}

/** Compact refresh icon for buttons. */
export function RefreshIcon({ size = 13 }: { readonly size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
