import type { OrderStatus, PaymentStatus, SubOrderStatus } from '@taptym/shared';
import { C } from '@/lib/theme';
import { useT, type TKey } from '@/i18n';
import { Badge, type IconName } from './ui';

const ORDER_TONE: Record<OrderStatus, { c: string; bg: string; icon: IconName }> = {
  placed: { c: C.primary, bg: C.primarySoft, icon: 'time' },
  in_progress: { c: '#B54708', bg: C.warningSoft, icon: 'sync' },
  completed: { c: C.successInk, bg: C.successSoft, icon: 'checkmark-circle' },
  cancelled: { c: C.muted, bg: C.surface, icon: 'close-circle' },
};

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  const t = useT();
  const tone = ORDER_TONE[status];
  return <Badge label={t(`os_${status}` as TKey)} color={tone.c} bg={tone.bg} icon={tone.icon} />;
}

export function SubStatusChip({ status }: { status: SubOrderStatus }) {
  const t = useT();
  const bad = status === 'cancelled' || status === 'rejected';
  const done = status === 'delivered';
  return (
    <Badge
      label={t(`ss_${status}` as TKey)}
      color={bad ? C.danger : done ? C.successInk : C.primary}
      bg={bad ? C.dangerSoft : done ? C.successSoft : C.primarySoft}
    />
  );
}

export function PaymentChip({ status }: { status: PaymentStatus }) {
  const t = useT();
  const ok = status === 'paid' || status === 'cash_on_delivery';
  const warn = status === 'pending' || status === 'awaiting_invoice';
  return (
    <Badge
      label={t(`ps_${status}` as TKey)}
      icon={ok ? 'shield-checkmark' : warn ? 'hourglass' : 'alert-circle'}
      color={ok ? C.successInk : warn ? '#B54708' : C.danger}
      bg={ok ? C.successSoft : warn ? C.warningSoft : C.dangerSoft}
    />
  );
}
