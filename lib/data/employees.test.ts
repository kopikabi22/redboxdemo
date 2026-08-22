import { beforeEach, describe, expect, it } from 'vitest';
import { StorageKeys, writeCollection } from './storage';
import { createEmployee, updateEmployee, deleteEmployee, getEmployees, getManageableEmployees } from './employees';
import { getSessionEmployee, setSessionEmployee } from './session';
import type { Branch, Employee } from './types';

const BRANCH_HQ = 'br_hq';
const BRANCH_A = 'br_a';
const BRANCH_B = 'br_b';

function seedBranches() {
  writeCollection<Branch>(StorageKeys.branches, [
    { id: BRANCH_HQ, name: 'Cabang HQ', city: '', province: '', address: '', phone: '' },
    { id: BRANCH_A, name: 'Cabang A', city: '', province: '', address: '', phone: '' },
    { id: BRANCH_B, name: 'Cabang B', city: '', province: '', address: '', phone: '' },
  ]);
}

// Owner is stationed at a separate branch from either BranchManager on
// purpose, so "BranchManager only sees their own branch" isn't accidentally
// satisfied just because Owner happens to share a branchId with them.
const owner: Employee = { id: 'emp_owner', name: 'Owner', role: 'Owner', branchId: BRANCH_HQ, pin: '9999' };
const managerA: Employee = { id: 'emp_mgr_a', name: 'Manager A', role: 'BranchManager', branchId: BRANCH_A, pin: '1111' };
const managerB: Employee = { id: 'emp_mgr_b', name: 'Manager B', role: 'BranchManager', branchId: BRANCH_B, pin: '2222' };

function seedEmployees(extra: Employee[] = []) {
  writeCollection<Employee>(StorageKeys.employees, [owner, managerA, managerB, ...extra]);
}

beforeEach(() => {
  window.localStorage.clear();
  seedBranches();
  seedEmployees();
});

describe('createEmployee — PIN validation', () => {
  it('throws when PIN is not exactly 4 digits, and writes nothing', () => {
    const before = getEmployees();

    expect(() => createEmployee({ name: 'Kasir Baru', role: 'Kasir', branchId: BRANCH_A, pin: '123' }, owner)).toThrowError(
      'PIN harus 4 digit angka.',
    );
    expect(() => createEmployee({ name: 'Kasir Baru', role: 'Kasir', branchId: BRANCH_A, pin: 'abcd' }, owner)).toThrowError(
      'PIN harus 4 digit angka.',
    );
    expect(() => createEmployee({ name: 'Kasir Baru', role: 'Kasir', branchId: BRANCH_A, pin: '12345' }, owner)).toThrowError(
      'PIN harus 4 digit angka.',
    );

    expect(getEmployees()).toEqual(before);
  });

  it('succeeds with a valid 4-digit PIN', () => {
    const created = createEmployee({ name: 'Kasir Baru', role: 'Kasir', branchId: BRANCH_A, pin: '5678' }, owner);
    expect(created.pin).toBe('5678');
    expect(getEmployees()).toHaveLength(4);
  });
});

describe('deleteEmployee — self-delete guard', () => {
  it('throws when an employee tries to delete their own account, and writes nothing', () => {
    const before = getEmployees();
    expect(() => deleteEmployee(owner.id, owner)).toThrowError('Tidak bisa menghapus akun sendiri yang sedang login.');
    expect(getEmployees()).toEqual(before);
  });

  it('deleting a DIFFERENT employee who has an active karyawan session does not crash — that session just resolves to null afterwards', () => {
    const kasir: Employee = { id: 'emp_kasir', name: 'Kasir X', role: 'Kasir', branchId: BRANCH_A, pin: '1234' };
    seedEmployees([kasir]);
    setSessionEmployee('karyawan', kasir);
    expect(getSessionEmployee('karyawan')?.id).toBe(kasir.id);

    expect(() => deleteEmployee(kasir.id, owner)).not.toThrow();

    // The stale session pointer is still in localStorage, but session.ts
    // re-reads it against the (now missing) master record on every call —
    // it resolves to null instead of crashing, which is what every POV
    // Karyawan page relies on to force-logout automatically.
    expect(getSessionEmployee('karyawan')).toBeNull();
  });
});

describe('RBAC scoping via getManageableEmployees / branch guards', () => {
  it('Owner sees every employee regardless of branch', () => {
    expect(getManageableEmployees(owner)).toHaveLength(3);
  });

  it('BranchManager only sees employees in their own branch', () => {
    const result = getManageableEmployees(managerA);
    expect(result.map((e) => e.id)).toEqual([managerA.id]);
  });

  it('BranchManager cannot create an employee in a different branch, and writes nothing', () => {
    const before = getEmployees();
    expect(() => createEmployee({ name: 'Sneaky', role: 'Kasir', branchId: BRANCH_B, pin: '1234' }, managerA)).toThrowError(
      'Tidak punya akses untuk menambah karyawan di cabang ini.',
    );
    expect(getEmployees()).toEqual(before);
  });

  it('BranchManager cannot edit an employee in a different branch', () => {
    expect(() => updateEmployee(managerB.id, { name: 'Renamed' }, managerA)).toThrowError('Tidak punya akses ke karyawan ini.');
  });

  it('BranchManager cannot change branchId (transfer) even for their own employee', () => {
    expect(() => updateEmployee(managerA.id, { branchId: BRANCH_B }, managerA)).toThrowError(
      'Transfer cabang karyawan hanya bisa dilakukan Owner/HQ.',
    );
  });

  it('Owner CAN transfer an employee to a different branch', () => {
    const updated = updateEmployee(managerA.id, { branchId: BRANCH_B }, owner);
    expect(updated.branchId).toBe(BRANCH_B);
  });
});

describe('role-escalation guard', () => {
  it('BranchManager cannot create an employee with role "Owner", and writes nothing', () => {
    const before = getEmployees();
    expect(() => createEmployee({ name: 'Sneaky', role: 'Owner', branchId: BRANCH_A, pin: '1234' }, managerA)).toThrowError(
      'Hanya Owner/HQ yang bisa menetapkan role BranchManager/Owner.',
    );
    expect(getEmployees()).toEqual(before);
  });

  it('BranchManager cannot promote an employee in their own branch to "BranchManager"', () => {
    const kasir: Employee = { id: 'emp_kasir_a', name: 'Kasir A', role: 'Kasir', branchId: BRANCH_A, pin: '4321' };
    seedEmployees([kasir]);
    expect(() => updateEmployee(kasir.id, { role: 'BranchManager' }, managerA)).toThrowError(
      'Hanya Owner/HQ yang bisa menetapkan role BranchManager/Owner.',
    );
  });

  it('BranchManager editing an already-elevated employee\'s NAME succeeds even when the form resubmits the SAME role — only an actual change is blocked', () => {
    // The Employee Master form always sends the full payload including
    // `role` (whatever the form currently shows), not just the fields the
    // user touched. So the realistic repro here is patch.role EXPLICITLY
    // set to 'BranchManager' — same as managerA's current role — alongside
    // an unrelated name change, not simply omitting `role` from the patch.
    const updated = updateEmployee(managerA.id, { name: 'Manager A (Renamed)', role: 'BranchManager' }, managerA);
    expect(updated.name).toBe('Manager A (Renamed)');
    expect(updated.role).toBe('BranchManager');
  });

  it('BranchManager CAN create/update employees with role "Kasir" or "Barber" in their own branch', () => {
    const created = createEmployee({ name: 'Kasir Baru', role: 'Kasir', branchId: BRANCH_A, pin: '1122' }, managerA);
    expect(created.role).toBe('Kasir');

    const barber: Employee = { id: 'emp_barber_a', name: 'Barber A', role: 'Barber', branchId: BRANCH_A, pin: '3344' };
    seedEmployees([created, barber]);
    const updated = updateEmployee(barber.id, { role: 'Kasir' }, managerA);
    expect(updated.role).toBe('Kasir');
  });

  it('Owner is unaffected by the role-escalation guard — can freely assign any role', () => {
    const created = createEmployee({ name: 'New Manager', role: 'BranchManager', branchId: BRANCH_A, pin: '5566' }, owner);
    expect(created.role).toBe('BranchManager');

    const updated = updateEmployee(managerB.id, { role: 'Owner' }, owner);
    expect(updated.role).toBe('Owner');
  });
});
