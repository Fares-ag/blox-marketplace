import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertCanManageUserRole,
  assertCanProvisionRole,
  assertHomeBranchInCompany,
} from './user-provisioning.policy';

const admin = { role: UserRole.admin } as never;
const superAdmin = { role: UserRole.super_admin } as never;
const groupAdmin = { role: UserRole.group_admin } as never;

describe('user provisioning policy', () => {
  it('allows platform admin to provision credit officers and other admins', () => {
    expect(() => assertCanProvisionRole(admin, UserRole.credit_officer)).not.toThrow();
    expect(() => assertCanProvisionRole(admin, UserRole.admin)).not.toThrow();
    expect(() => assertCanProvisionRole(admin, UserRole.group_admin)).not.toThrow();
  });

  it('blocks non-super-admin from creating super_admin', () => {
    expect(() => assertCanProvisionRole(admin, UserRole.super_admin)).toThrow(ForbiddenException);
    expect(() => assertCanProvisionRole(superAdmin, UserRole.super_admin)).not.toThrow();
  });

  it('allows group_admin to provision credit officers but not platform admins', () => {
    expect(() => assertCanProvisionRole(groupAdmin, UserRole.credit_officer)).not.toThrow();
    expect(() => assertCanProvisionRole(groupAdmin, UserRole.admin)).toThrow('forbidden_role');
  });

  it('allows platform admin to manage admin accounts', () => {
    expect(() => assertCanManageUserRole(admin, UserRole.admin, UserRole.credit_officer)).not.toThrow();
    expect(() => assertCanManageUserRole(admin, UserRole.super_admin, UserRole.admin)).toThrow(
      'super_admin_required',
    );
  });

  describe('home branch', () => {
    it('accepts a branch of the same company', () => {
      expect(() =>
        assertHomeBranchInCompany({ id: 'b1', companyId: 'audi' }, 'audi'),
      ).not.toThrow();
    });

    it('rejects a branch of another company or an unknown branch', () => {
      expect(() => assertHomeBranchInCompany({ id: 'b1', companyId: 'vw' }, 'audi')).toThrow(
        'branch_not_in_company',
      );
      expect(() => assertHomeBranchInCompany(null, 'audi')).toThrow(BadRequestException);
    });

    it('requires a company before a branch can be assigned', () => {
      expect(() => assertHomeBranchInCompany({ id: 'b1', companyId: 'audi' }, null)).toThrow(
        'branch_requires_company',
      );
    });
  });
});
