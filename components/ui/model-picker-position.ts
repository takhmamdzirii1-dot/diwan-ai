export type PickerAnchor = { top?: number; bottom?: number; left: number; height: number };

export function positionModelPicker(
  rect: Pick<DOMRect, 'top' | 'bottom' | 'left'>,
  viewportWidth: number,
  viewportHeight: number,
  preferred: 'top' | 'bottom',
): PickerAnchor {
  const width = Math.min(408, viewportWidth - 32);
  const above = rect.top - 24;
  const below = viewportHeight - rect.bottom - 24;
  const placeAbove = preferred === 'top'
    ? above >= 260 || above > below
    : below < 300 && above > below;
  const height = Math.min(540, Math.max(0, (placeAbove ? above : below) - 8));
  const left = Math.max(16, Math.min(rect.left, viewportWidth - width - 16));
  return placeAbove
    ? { bottom: viewportHeight - rect.top + 8, left, height }
    : { top: rect.bottom + 8, left, height };
}
