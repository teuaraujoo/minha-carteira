export const CategoryStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type CategoryStatus = (typeof CategoryStatus)[keyof typeof CategoryStatus];
