// ============================================================================
// apps/api — enum registrations
// ----------------------------------------------------------------------------
// Exposes Prisma enums as GraphQL enums so every resolver can reference them
// by the same symbolic name as the SDL contract.
// ============================================================================

import {
  BillingCycle,
  CategoryKind,
  DocumentStatus,
  DocumentType,
  Locale,
  ReminderChannel,
  SubscriptionStatus,
  TransactionSource,
  TransactionType,
} from "@lifeos/db";
import { builder } from "./builder.js";

builder.enumType(Locale, { name: "Locale" });
builder.enumType(CategoryKind, { name: "CategoryKind" });
builder.enumType(TransactionType, { name: "TransactionType" });
builder.enumType(TransactionSource, { name: "TransactionSource" });
builder.enumType(BillingCycle, { name: "BillingCycle" });
builder.enumType(SubscriptionStatus, { name: "SubscriptionStatus" });
builder.enumType(DocumentType, { name: "DocumentType" });
builder.enumType(DocumentStatus, { name: "DocumentStatus" });
builder.enumType(ReminderChannel, { name: "ReminderChannel" });

export const SortDirection = builder.enumType("SortDirection", {
  values: ["ASC", "DESC"] as const,
});

export const TransactionSortField = builder.enumType("TransactionSortField", {
  values: ["OCCURRED_AT", "AMOUNT", "CREATED_AT"] as const,
});
