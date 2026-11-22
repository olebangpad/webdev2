import type { ReactNode } from 'react';
import { ITEM_TYPES, labelOf } from '../core/labels';
import type { ItemType } from '../core/types';

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'fg' | 'sfg' | 'rm' | 'sub' | 'con';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

const TYPE_TONE: Record<ItemType, Tone> = { FG: 'fg', SFG: 'sfg', RM: 'rm', SUB: 'sub', CON: 'con' };

export function ItemTypeBadge({ type }: { type: ItemType }) {
  return <Badge tone={TYPE_TONE[type]}>{labelOf(ITEM_TYPES, type)}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'ok' : 'neutral'}>{active ? '사용' : '중지'}</Badge>;
}
