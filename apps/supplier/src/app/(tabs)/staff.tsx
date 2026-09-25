import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPhone, normalizePhone, type SupplierRole, type SupplierStaff } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { LoadError } from '@/components/LoadError';
import { Sheet } from '@/components/Sheet';
import { Button, Card, digits, Divider, Empty, Field, IconBtn, Pill, Row, SkeletonList, Toggle, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { confirm, toast } from '@/lib/overlay';
import type { TKey } from '../../i18n';

const ROLES: { role: Exclude<SupplierRole, 'owner'>; icon: any }[] = [
  { role: 'manager', icon: 'briefcase-outline' },
  { role: 'cashier', icon: 'cash-outline' },
  { role: 'warehouse', icon: 'cube-outline' },
];

export default function Staff() {
  const t = useT();
  const { data, error, loading, refreshing, refresh, reload } = useApi<SupplierStaff[]>('/api/s/staff');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', role: 'cashier' as Exclude<SupplierRole, 'owner'> });
  const [editing, setEditing] = useState<SupplierStaff | null>(null);

  const openAdd = () => {
    setEditing(null);
    setF({ name: '', phone: '', role: 'cashier' });
    setOpen(true);
  };
  const openEdit = (s: SupplierStaff) => {
    setEditing(s);
    setF({ name: s.name, phone: digits(s.phone).replace(/^996/, ''), role: s.role as Exclude<SupplierRole, 'owner'> });
    setOpen(true);
  };
  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/api/s/staff/${editing.id}`, { method: 'PATCH', body: { name: f.name.trim(), role: f.role } });
      toast(t('saved'));
      setOpen(false);
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      await api('/api/s/staff', { body: { name: f.name.trim(), phone: normalizePhone('996' + f.phone), role: f.role } });
      toast(t('staff_added'));
      setOpen(false);
      setF({ name: '', phone: '', role: 'cashier' });
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const patch = async (s: SupplierStaff, body: object, msg?: string) => {
    try {
      await api(`/api/s/staff/${s.id}`, { method: 'PATCH', body });
      if (msg) toast(msg);
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    }
  };
  const remove = async (s: SupplierStaff) => {
    if (!(await confirm({ title: t('staff_remove_q'), message: `${s.name} · ${formatPhone(s.phone)}`, confirmText: t('delete'), danger: true }))) return;
    try {
      await api(`/api/s/staff/${s.id}`, { method: 'DELETE' });
      toast(t('deleted'));
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    }
  };

  return (
    <Screen
      back="/more"
      detail
      title={t('m_staff')}
      subtitle={t('staff_sub')}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={<Button title={t('staff_add')} icon="person-add-outline" onPress={openAdd} testID="staff-add" />}
    >
      <LoadError error={error} onRetry={reload} compact={!!data} />
      {!data && error ? null : loading ? (
        <SkeletonList n={3} />
      ) : (
        <Card pad={8}>
          {data?.length === 0 ? <Empty emoji="👥" title={t('no_staff')} /> : null}
          {(data ?? []).map((s, i) => (
            <View key={s.id}>
              {i > 0 ? <Divider style={{ marginHorizontal: 12 }} /> : null}
              <Row gap={12} style={{ padding: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: s.active ? C.primarySoft : C.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt v="bodyB" color={s.active ? C.primary : C.faint}>
                    {s.name.slice(0, 1).toUpperCase()}
                  </Txt>
                </View>
                <Pressable
                  disabled={s.role === 'owner'}
                  onPress={() => openEdit(s)}
                  style={({ pressed }) => [{ flex: 1, gap: 3 }, pressed && { opacity: 0.7 }]}
                  accessibilityRole={s.role === 'owner' ? undefined : 'button'}
                  testID={`staff-edit-${s.id}`}
                >
                  <Txt v="bodyB" color={s.active ? C.ink : C.muted}>
                    {s.name}
                  </Txt>
                  <Row gap={6} wrap>
                    <Pill tone={s.role === 'owner' ? 'primary' : 'neutral'} label={t(`role_${s.role}` as TKey)} icon={s.role === 'owner' ? undefined : 'create-outline'} />
                    <Txt v="cap">{formatPhone(s.phone)}</Txt>
                  </Row>
                </Pressable>
                {s.role !== 'owner' ? (
                  <>
                    <Toggle value={s.active} onChange={(v) => patch(s, { active: v }, v ? t('staff_on') : t('staff_off'))} label={t('active')} />
                    <IconBtn icon="trash-outline" label={t('delete')} color={C.danger} bg={C.dangerSoft} size={40} onPress={() => remove(s)} />
                  </>
                ) : null}
              </Row>
            </View>
          ))}
        </Card>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('staff_edit') : t('staff_add')}
        subtitle={editing ? t('staff_edit_sub') : t('staff_add_sub')}
        footer={
          editing ? (
            <Button title={t('save')} icon="checkmark" onPress={saveEdit} loading={busy} disabled={!f.name.trim()} testID="staff-save" />
          ) : (
            <Button title={t('staff_add')} icon="checkmark" onPress={add} loading={busy} disabled={!f.name.trim() || f.phone.length !== 9} testID="staff-submit" />
          )
        }
      >
        <Field label={t('staff_name')} value={f.name} onChangeText={(x) => setF({ ...f, name: x })} placeholder={t('staff_name_ph')} testID="staff-name" />
        <Field label={t('phone')} prefix="+996" value={f.phone} onChangeText={(x) => setF({ ...f, phone: digits(x).replace(/^996/, '').slice(0, 9) })} keyboardType="phone-pad" placeholder="555 123 456" editable={!editing} testID="staff-phone" />
        <Txt v="capB">{t('staff_role')}</Txt>
        {ROLES.map((r) => {
          const on = f.role === r.role;
          return (
            <Pressable key={r.role} onPress={() => setF({ ...f, role: r.role })} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: on ? C.primary : C.line, backgroundColor: on ? C.primaryTint : C.card, alignItems: 'center' }} testID={`role-${r.role}`}>
              <Ionicons name={r.icon} size={24} color={on ? C.primary : C.ink2} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyB">{t(`role_${r.role}` as TKey)}</Txt>
                <Txt v="cap">{t(`role_${r.role}_d` as TKey)}</Txt>
              </View>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? C.primary : C.faint} />
            </Pressable>
          );
        })}
        {!editing ? <Txt v="cap">{t('staff_login_hint')}</Txt> : null}
      </Sheet>
    </Screen>
  );
}
