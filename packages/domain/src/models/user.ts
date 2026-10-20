import { ForbiddenError } from "../errors";

export type Role = "SITE_MANAGER" | "PROCUREMENT_STAFF" | "MANAGEMENT_STAFF";
export type ManagementLevel = "OPERATIONAL" | "SENIOR";

export abstract class User {
  constructor(
    public readonly userId: string,
    public name: string,
    public email: string,
    public contactNumber: string,
  ) {}

  abstract readonly role: Role;
}

export class SiteManager extends User {
  readonly role = "SITE_MANAGER" as const;

  constructor(
    userId: string,
    name: string,
    email: string,
    contactNumber: string,
    public siteId: string | null,
  ) {
    super(userId, name, email, contactNumber);
  }
}

export class ProcurementStaff extends User {
  readonly role = "PROCUREMENT_STAFF" as const;
}

export class ManagementStaff extends User {
  readonly role = "MANAGEMENT_STAFF" as const;

  constructor(
    userId: string,
    name: string,
    email: string,
    contactNumber: string,
    public level: ManagementLevel,
  ) {
    super(userId, name, email, contactNumber);
  }
}

export function assertRole(user: User, role: Role): void {
  if (user.role !== role) {
    throw new ForbiddenError(`A ${user.role.replaceAll("_", " ").toLowerCase()} cannot perform this action`);
  }
}
