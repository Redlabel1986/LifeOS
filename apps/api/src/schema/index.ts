// ============================================================================
// apps/api — schema entry
// ----------------------------------------------------------------------------
// Imports every resolver module for their side effects (each one registers
// types/fields on the shared builder), then exports the built schema.
// ============================================================================

import { builder } from "./builder.js";

import "./enums.js";
import "./shared.js";
import "./user.js";
import "./category.js";
import "./merchant.js";
import "./transaction.js";
import "./subscription.js";
import "./document.js";
import "./budget.js";
import "./dashboard.js";
import "./tax.js";
import "./ai.js";
import "./bank.js";

export const schema = builder.toSchema();
