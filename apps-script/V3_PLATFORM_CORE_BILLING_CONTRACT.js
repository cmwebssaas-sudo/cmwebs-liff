var CMWebsCoreBillingContracts = function(exports) {
  "use strict";
  class InvalidIdentifierError extends Error {
    constructor(value, prefix) {
      super(`Invalid ${prefix} identifier: ${value}`);
      this.name = "InvalidIdentifierError";
    }
  }
  function createId(value, prefix) {
    const pattern = new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]*$`);
    if (!pattern.test(value)) {
      throw new InvalidIdentifierError(value, prefix);
    }
    return value;
  }
  const companyId = (value) => createId(value, "com");
  const productId = (value) => createId(value, "prd");
  const planId = (value) => createId(value, "pln");
  const planVersionId = (value) => createId(value, "plv");
  class BillingError extends Error {
    constructor(code, message = code) {
      super(message);
      this.code = code;
      this.name = "BillingError";
    }
  }
  function billingInteger(value, minimum = 0) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum)
      throw new BillingError("INVALID_REQUEST");
    return value;
  }
  function billingText(value, maximum = 200, allowEmpty = false) {
    if (typeof value !== "string" || value.length > maximum || !allowEmpty && !value.trim())
      throw new BillingError("INVALID_REQUEST");
    return value.trim();
  }
  function assertRoomLimit(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new BillingError("INVALID_REQUEST");
    const v = value;
    if (v.mode === "LIMITED") billingInteger(v.maxRooms);
    else if (v.mode !== "UNLIMITED" || "maxRooms" in v) throw new BillingError("INVALID_REQUEST");
  }
  function assertCommercialPlanDraft(input) {
    if (!input || typeof input !== "object") throw new BillingError("INVALID_REQUEST");
    productId(input.productId);
    billingText(input.displayName);
    billingText(input.description, 4e3, true);
    if (!Number.isSafeInteger(input.sortOrder)) throw new BillingError("INVALID_REQUEST");
    billingInteger(input.amountTwd);
    billingInteger(input.trialDays);
    billingInteger(input.paymentDueDays, 1);
    if (!input.cycle || !["DAY", "MONTH", "YEAR"].includes(input.cycle.unit)) throw new BillingError("INVALID_REQUEST");
    billingInteger(input.cycle.interval, 1);
    assertRoomLimit(input.roomLimit);
  }
  class ContractValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = "ContractValidationError";
    }
  }
  function record$2(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ContractValidationError(`${label} must be an object`);
    }
    return value;
  }
  function nonEmptyString$2(value, label) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new ContractValidationError(`${label} must be a non-empty string`);
    }
    return value;
  }
  function capabilityCode(value, label) {
    const code = nonEmptyString$2(value, label);
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(code)) {
      throw new ContractValidationError(`${label} must be a lowercase dot-path`);
    }
    return code;
  }
  function timestamp$1(value, label) {
    const result = nonEmptyString$2(value, label);
    if (Number.isNaN(Date.parse(result))) {
      throw new ContractValidationError(`${label} must be an ISO timestamp`);
    }
    return result;
  }
  function scalar(value, label) {
    if (typeof value === "boolean" || typeof value === "string") {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    throw new ContractValidationError(`${label} must be a finite JSON scalar`);
  }
  function valueForType(value, valueType, label) {
    const scalarValue = scalar(value, label);
    switch (valueType) {
      case "BOOLEAN":
        if (typeof scalarValue !== "boolean") throw new ContractValidationError(`${label} must be boolean`);
        return scalarValue;
      case "INTEGER":
        if (typeof scalarValue !== "number" || !Number.isSafeInteger(scalarValue)) {
          throw new ContractValidationError(`${label} must be a safe integer`);
        }
        return scalarValue;
      case "DECIMAL":
        if (typeof scalarValue !== "number") throw new ContractValidationError(`${label} must be a number`);
        return scalarValue;
      case "ENUM":
        if (typeof scalarValue !== "string") throw new ContractValidationError(`${label} must be a string`);
        return scalarValue;
      default:
        throw new ContractValidationError(`${label} has an unsupported value_type`);
    }
  }
  function parseCommonEnvelope(input) {
    const value = record$2(input, "response");
    return {
      ...value,
      request_id: nonEmptyString$2(value.request_id, "request_id"),
      company_id: nonEmptyString$2(value.company_id, "company_id"),
      product_id: nonEmptyString$2(value.product_id, "product_id"),
      evaluated_at: timestamp$1(value.evaluated_at, "evaluated_at")
    };
  }
  function parseEntitlementsResponse(input) {
    const envelope = parseCommonEnvelope(input);
    if (!Array.isArray(envelope.entitlements)) {
      throw new ContractValidationError("entitlements must be an array");
    }
    const entitlements = envelope.entitlements.map((item, index) => {
      const resource = record$2(item, `entitlements[${index}]`);
      const valueType = resource.value_type;
      if (!["BOOLEAN", "INTEGER", "DECIMAL", "ENUM"].includes(String(valueType))) {
        throw new ContractValidationError(`entitlements[${index}].value_type is unsupported`);
      }
      return {
        subscription_id: nonEmptyString$2(resource.subscription_id, `entitlements[${index}].subscription_id`),
        plan_id: nonEmptyString$2(resource.plan_id, `entitlements[${index}].plan_id`),
        definition_id: nonEmptyString$2(resource.definition_id, `entitlements[${index}].definition_id`),
        code: capabilityCode(resource.code, `entitlements[${index}].code`),
        value_type: valueType,
        value: valueForType(resource.value, valueType, `entitlements[${index}].value`),
        source: resource.source === "plan" || resource.source === "subscription_override" || resource.source === "subscription_period" ? resource.source : (() => {
          throw new ContractValidationError(`entitlements[${index}].source is unsupported`);
        })()
      };
    });
    return {
      request_id: envelope.request_id,
      company_id: envelope.company_id,
      product_id: envelope.product_id,
      evaluated_at: envelope.evaluated_at,
      entitlements
    };
  }
  function billingObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContractValidationError("Invalid billing object");
    return value;
  }
  function billingInstant(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value)))
      throw new ContractValidationError("Invalid billing timestamp");
    return value;
  }
  function billingIdentifier(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value)) throw new ContractValidationError("Invalid billing identifier");
    return value;
  }
  function commercialPlanToDto(plan) {
    const t = plan.terms;
    assertCommercialPlanDraft(t);
    return { plan_id: plan.planId, plan_version_id: plan.planVersionId, terms: {
      product_id: t.productId,
      display_name: t.displayName,
      description: t.description,
      sort_order: t.sortOrder,
      amount_twd: t.amountTwd,
      cycle: { ...t.cycle },
      trial_days: t.trialDays,
      payment_due_days: t.paymentDueDays,
      room_limit: t.roomLimit.mode === "LIMITED" ? { mode: "LIMITED", max_rooms: t.roomLimit.maxRooms } : { mode: "UNLIMITED" }
    } };
  }
  function parseCommercialPlanDto(value) {
    const p = billingObject(value), t = billingObject(p.terms), c = billingObject(t.cycle), r = billingObject(t.room_limit);
    if (r.mode === "UNLIMITED" && "max_rooms" in r) throw new ContractValidationError("Ambiguous room limit");
    const terms = {
      productId: productId(billingIdentifier(t.product_id)),
      displayName: billingText(t.display_name),
      description: billingText(t.description, 4e3, true),
      sortOrder: t.sort_order,
      amountTwd: billingInteger(t.amount_twd),
      cycle: { unit: c.unit, interval: billingInteger(c.interval, 1) },
      trialDays: billingInteger(t.trial_days),
      paymentDueDays: billingInteger(t.payment_due_days, 1),
      roomLimit: r.mode === "LIMITED" ? { mode: "LIMITED", maxRooms: billingInteger(r.max_rooms) } : { mode: r.mode }
    };
    assertCommercialPlanDraft(terms);
    return commercialPlanToDto({ planId: planId(billingIdentifier(p.plan_id)), planVersionId: planVersionId(billingIdentifier(p.plan_version_id)), terms });
  }
  function billingOrderToDto(order) {
    return {
      order_id: order.orderId,
      company_id: order.scope.companyId,
      product_id: order.scope.productId,
      purpose: order.purpose,
      status: order.status,
      provider_id: order.providerId,
      amount_twd: order.amountTwd,
      expires_at: order.expiresAt.toISOString(),
      plan: commercialPlanToDto(order.plan),
      ...order.bankVersionId ? { bank_version_id: order.bankVersionId } : {}
    };
  }
  function parseBillingEnvelope(input, expected) {
    const v = billingObject(input);
    const result = { request_id: billingIdentifier(v.request_id), company_id: companyId(billingIdentifier(v.company_id)), product_id: productId(billingIdentifier(v.product_id)) };
    if (result.company_id !== expected.companyId || result.product_id !== expected.productId) throw new ContractValidationError("Invalid billing scope");
    return result;
  }
  function parseBillingOrderDto(input, expected) {
    const o = billingObject(input);
    if (o.company_id !== expected.companyId || o.product_id !== expected.productId) throw new ContractValidationError("Invalid order scope");
    const plan = parseCommercialPlanDto(o.plan);
    if (plan.terms.product_id !== expected.productId || !["INITIAL", "RENEWAL"].includes(String(o.purpose)) || !["AWAITING_PAYMENT", "UNDER_REVIEW", "PAID", "CANCELLED", "EXPIRED"].includes(String(o.status))) throw new ContractValidationError("Invalid order state");
    const amount_twd = billingInteger(o.amount_twd);
    if (amount_twd !== plan.terms.amount_twd) throw new ContractValidationError("Invalid order price");
    return {
      order_id: billingIdentifier(o.order_id),
      company_id: expected.companyId,
      product_id: expected.productId,
      purpose: o.purpose,
      status: o.status,
      provider_id: billingIdentifier(o.provider_id),
      amount_twd,
      expires_at: billingInstant(o.expires_at),
      plan,
      ...o.bank_version_id === void 0 ? {} : { bank_version_id: billingIdentifier(o.bank_version_id) }
    };
  }
  function parseBillingOrderResponse(input, expected) {
    return { ...parseBillingEnvelope(input, expected), order: parseBillingOrderDto(billingObject(input).order, expected) };
  }
  function isBillingOperation(operation) {
    return billingOperationPatterns.some((pattern) => new RegExp("^" + pattern.replace(/:[A-Za-z]+/g, "[A-Za-z0-9_.:-]+") + "$").test(operation));
  }
  const billingOperationPatterns = ["member/plans/query", "member/orders/create", "member/orders/query", "member/orders/:orderId/reports", "member/orders/:orderId/cancel", "member/subscription/query", "member/subscription/start-trial", "member/subscription/activate-free", "member/subscription/renew", "member/subscription/cancel-renewal", "admin/me", "admin/plans/query", "admin/plans/save", "admin/plans/publish", "admin/plans/retire", "admin/banks/query", "admin/banks/save", "admin/banks/disable", "admin/orders/query", "admin/orders/:orderId/confirm", "admin/orders/:orderId/reject", "admin/receipts/:receiptId/reverse", "admin/members/query", "admin/members/role", "admin/subscriptions/query", "admin/audit/query", "admin/workspace-mode/authorize", "admin/workspace-mode/applied"];
  const requestFields = {
    provision: { required: ["workspace_display_name", "role"] },
    "member/orders/create": { required: ["plan_version_id", "purpose", "provider_id"] },
    "member/orders/query": { required: [], optional: ["status", "order_id"] },
    "admin/orders/query": { required: [], optional: ["status", "order_id"] },
    "member/orders/:orderId/reports": { required: ["transferred_at", "amount_twd"], optional: ["last_five", "reference", "note"] },
    "member/orders/:orderId/cancel": { required: ["reason"] },
    "member/subscription/start-trial": { required: ["plan_version_id"] },
    "member/subscription/activate-free": { required: ["plan_version_id"] },
    "member/subscription/renew": { required: ["plan_version_id"] },
    "admin/plans/save": { required: ["terms"], optional: ["draft_id"] },
    "admin/plans/publish": { required: ["draft_id"] },
    "admin/plans/retire": { required: ["plan_id", "reason"] },
    "admin/banks/query": { required: [], optional: ["bank_version_id"] },
    "admin/banks/save": { required: ["bank_name", "bank_code", "branch", "account_name", "account_number", "instructions", "enabled"] },
    "admin/banks/disable": { required: ["bank_version_id", "reason"] },
    "admin/orders/:orderId/confirm": { required: ["received_at", "amount_twd", "reference", "reason"], optional: ["accept_exceptional_order", "accept_period_conflict"] },
    "admin/orders/:orderId/reject": { required: ["reason"] },
    "admin/receipts/:receiptId/reverse": { required: ["reason"] },
    "admin/members/query": { required: [], optional: ["company_id", "cursor"] },
    "admin/subscriptions/query": { required: [], optional: ["company_id", "cursor"] },
    "admin/members/role": { required: ["platform_user_id", "role", "assigned", "reason"] },
    "admin/audit/query": { required: [], optional: ["company_id", "cursor"] },
    "admin/workspace-mode/authorize": { required: ["external_workspace_id", "mode", "reason"] },
    "admin/workspace-mode/applied": { required: ["intent_id", "applied_at"] }
  };
  function billingRequestFields(operation) {
    var _a;
    const pattern = operation === "provision" ? "provision" : billingOperationPatterns.find((p) => new RegExp("^" + p.replace(/:[A-Za-z]+/g, "[A-Za-z0-9_.:-]+") + "$").test(operation));
    if (!pattern) throw new ContractValidationError("Unknown operation");
    return (_a = requestFields[pattern]) != null ? _a : { required: [] };
  }
  function commercialTermsToDto(terms) {
    return commercialPlanToDto({ planId: planId("pln_draft"), planVersionId: planVersionId("plv_draft"), terms }).terms;
  }
  function parseCommercialTermsDto(value) {
    const dto = parseCommercialPlanDto({ plan_id: "pln_draft", plan_version_id: "plv_draft", terms: value }).terms;
    return { productId: productId(dto.product_id), displayName: dto.display_name, description: dto.description, sortOrder: dto.sort_order, amountTwd: dto.amount_twd, cycle: dto.cycle, trialDays: dto.trial_days, paymentDueDays: dto.payment_due_days, roomLimit: dto.room_limit.mode === "LIMITED" ? { mode: "LIMITED", maxRooms: dto.room_limit.max_rooms } : { mode: "UNLIMITED" } };
  }
  function billingPeriodToDto(period) {
    return { period_id: period.periodId, subscription_id: period.subscriptionId, source: period.source, starts_at: period.startsAt.toISOString(), ends_at: period.endsAt.toISOString(), plan: commercialPlanToDto(period.plan), ...period.orderId ? { order_id: period.orderId } : {}, ...period.revokedAt ? { revoked_at: period.revokedAt.toISOString() } : {} };
  }
  function bankInstructionToDto(bank) {
    return { product_id: bank.productId, bank_name: bank.bankName, bank_code: bank.bankCode, branch: bank.branch, account_name: bank.accountName, account_number: bank.accountNumber, instructions: bank.instructions, enabled: bank.enabled };
  }
  function billingOrderDetailsToDto(details) {
    return { order: billingOrderToDto(details.order), ...details.instructions ? { instructions: bankInstructionToDto(details.instructions) } : {}, reports: details.reports.map((r) => ({ report_id: r.reportId, order_id: r.orderId, revision: r.revision, transferred_at: r.transferredAt.toISOString(), amount_twd: r.amountTwd, created_at: r.createdAt.toISOString(), ...r.lastFive ? { last_five: r.lastFive } : {}, ...r.reference ? { reference: r.reference } : {}, ...r.note ? { note: r.note } : {} })), events: details.events.map((e) => ({ event_id: e.eventId, order_id: e.orderId, type: e.type, reason: e.reason, created_at: e.createdAt.toISOString(), ...e.receiptId ? { receipt_id: e.receiptId } : {}, ...e.amountTwd === void 0 ? {} : { amount_twd: e.amountTwd }, ...e.receivedAt ? { received_at: e.receivedAt.toISOString() } : {} })), periods: details.periods.map(billingPeriodToDto) };
  }
  function billingBody(input, required, optional = []) {
    const body = billingObject(input);
    if (required.some((k) => !Object.hasOwn(body, k)) || Object.keys(body).some((k) => ![...required, ...optional].includes(k))) throw new ContractValidationError("Invalid billing fields");
    return body;
  }
  function parseBillingPeriodDto(input, scope) {
    const p = billingObject(input), plan = parseCommercialPlanDto(p.plan);
    billingIdentifier(p.period_id);
    billingIdentifier(p.subscription_id);
    const start = billingInstant(p.starts_at), end = billingInstant(p.ends_at);
    if (Date.parse(start) >= Date.parse(end) || plan.terms.product_id !== scope.productId || !["TRIAL", "FREE", "PAID"].includes(String(p.source))) throw new ContractValidationError("Invalid billing period");
    if (p.order_id !== void 0) billingIdentifier(p.order_id);
    if (p.revoked_at !== void 0) billingInstant(p.revoked_at);
    if (p.source === "PAID" !== (p.order_id !== void 0)) throw new ContractValidationError("Invalid period evidence");
    return p;
  }
  function billingArray(value) {
    if (!Array.isArray(value) || value.length > 1e4) throw new ContractValidationError("Invalid billing list");
    return value;
  }
  function billingBoolean(value) {
    if (typeof value !== "boolean") throw new ContractValidationError("Invalid billing flag");
    return value;
  }
  function nullableDate(value) {
    if (value !== null) billingInstant(value);
  }
  function billingBank(value, scope) {
    const b = billingObject(value);
    if (b.product_id !== scope.productId) throw new ContractValidationError("Invalid bank scope");
    for (const field of ["bank_name", "bank_code", "account_name", "account_number"]) billingText(b[field]);
    billingText(b.branch, 200, true);
    billingText(b.instructions, 4e3, true);
    billingBoolean(b.enabled);
  }
  function parseBillingOperationResponse(input, expected, operation) {
    parseBillingEnvelope(input, expected);
    const v = billingObject(input), admin = operation.startsWith("admin/");
    const order = (value) => {
      const o = billingObject(value);
      return parseBillingOrderDto(o, admin ? { companyId: companyId(billingIdentifier(o.company_id)), productId: expected.productId } : expected);
    };
    const period = (value) => parseBillingPeriodDto(value, expected);
    const plan = (value) => {
      const p = parseCommercialPlanDto(value);
      if (p.terms.product_id !== expected.productId) throw new ContractValidationError("Invalid plan scope");
      return p;
    };
    if (v.order !== void 0) order(v.order);
    if (v.period !== void 0) period(v.period);
    if (operation === "member/plans/query") billingArray(v.plans).forEach(plan);
    else if (operation.endsWith("orders/query")) {
      if (v.details !== void 0) {
        const d = billingObject(v.details), o = order(d.order);
        if (d.instructions !== void 0) billingBank(d.instructions, expected);
        billingArray(d.reports).forEach((value) => {
          const r = billingObject(value);
          billingIdentifier(r.report_id);
          if (r.order_id !== o.order_id) throw new ContractValidationError("Invalid report order");
          billingInteger(r.revision, 1);
          billingInteger(r.amount_twd, 1);
          billingInstant(r.transferred_at);
          billingInstant(r.created_at);
          if (r.last_five !== void 0 && (typeof r.last_five !== "string" || !/^\d{5}$/.test(r.last_five))) throw new ContractValidationError("Invalid report account");
          for (const field of ["reference", "note"]) if (r[field] !== void 0) billingText(r[field], 1e3, true);
        });
        billingArray(d.events).forEach((value) => {
          const e = billingObject(value);
          billingIdentifier(e.event_id);
          if (e.order_id !== o.order_id || !["CONFIRMED", "REJECTED", "REVERSED"].includes(String(e.type))) throw new ContractValidationError("Invalid payment event");
          billingText(e.reason, 1e3);
          billingInstant(e.created_at);
          if (e.receipt_id !== void 0) billingIdentifier(e.receipt_id);
          if (e.amount_twd !== void 0) billingInteger(e.amount_twd, 1);
          if (e.received_at !== void 0) billingInstant(e.received_at);
        });
        billingArray(d.periods).forEach((value) => {
          const p = period(value);
          if (p.order_id !== o.order_id) throw new ContractValidationError("Invalid order period");
        });
        if (admin) {
          const p = billingObject(v.preview);
          billingInstant(p.starts_at);
          billingInstant(p.ends_at);
          for (const field of ["requires_exceptional_order", "basis_changed", "can_confirm"]) billingBoolean(p[field]);
        }
      } else billingArray(v.orders).forEach(order);
    } else if (operation === "member/subscription/query") {
      const s = billingObject(v.subscription);
      if (!["NONE", "TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED", "PAST_DUE", "CANCELLED"].includes(String(s.status))) throw new ContractValidationError("Invalid subscription status");
      if (s.subscription_id !== null) billingIdentifier(s.subscription_id);
      nullableDate(s.renewal_cancelled_at);
      nullableDate(s.usable_until);
      if (s.current !== null) period(s.current);
      billingArray(s.future).forEach(period);
      billingArray(s.history).forEach(period);
      if (["ACTIVE", "TRIAL"].includes(String(s.status)) && s.current === null) throw new ContractValidationError("Active subscription has no period");
    } else if (operation === "member/subscription/renew") {
      if (v.kind === "PAYMENT_REQUIRED") {
        if (v.order === void 0 || v.period !== void 0) throw new ContractValidationError("Invalid renewal order");
      } else if (v.kind === "FREE_ACTIVATED") {
        if (v.period === void 0 || v.order !== void 0) throw new ContractValidationError("Invalid free renewal");
      } else throw new ContractValidationError("Invalid renewal kind");
    } else if (operation === "member/subscription/cancel-renewal") {
      nullableDate(v.usable_until);
      billingArray(v.cancelled_order_ids).forEach(billingIdentifier);
    } else if (operation === "admin/me") {
      const m = billingObject(v.me);
      billingIdentifier(m.platform_user_id);
      billingIdentifier(m.company_role);
      billingArray(m.platform_roles).forEach(billingIdentifier);
      billingBoolean(m.can_manage);
      billingBoolean(m.can_support);
    } else if (operation === "admin/plans/query") {
      billingArray(v.published).forEach(plan);
      billingArray(v.drafts).forEach((value) => {
        const d = billingObject(value);
        billingIdentifier(d.draft_id);
        if (d.plan_id !== null) billingIdentifier(d.plan_id);
        if (!["DRAFT", "PUBLISHED", "RETIRED"].includes(String(d.sale_state))) throw new ContractValidationError("Invalid plan sale state");
        const t = parseCommercialTermsDto(d.terms);
        if (t.productId !== expected.productId) throw new ContractValidationError("Invalid draft scope");
        billingInstant(d.updated_at);
      });
    } else if (operation === "admin/plans/publish") plan(v.plan);
    else if (operation === "admin/plans/save") billingIdentifier(v.draft_id);
    else if (operation === "admin/banks/query") {
      if (v.bank !== void 0) billingBank(v.bank, expected);
      else billingArray(v.banks).forEach((value) => {
        const b = billingObject(value);
        billingIdentifier(b.bank_version_id);
        billingBoolean(b.enabled);
        billingText(b.bank_name);
        billingText(b.account_last_four, 4);
        billingInstant(b.created_at);
        if ("account_number" in b || "account_name" in b) throw new ContractValidationError("Unmasked bank list");
      });
    } else if (operation === "admin/banks/save") {
      billingIdentifier(v.bank_version_id);
      billingBoolean(v.enabled);
    } else if (operation === "admin/members/query") {
      billingArray(v.members).forEach((value) => {
        const m = billingObject(value);
        billingIdentifier(m.platform_user_id);
        companyId(billingIdentifier(m.company_id));
        billingText(m.display_name);
        billingIdentifier(m.external_workspace_id);
        billingIdentifier(m.role_id);
        if (!["ACTIVE", "DISABLED"].includes(String(m.user_status)) || !["ACTIVE", "INACTIVE"].includes(String(m.membership_status))) throw new ContractValidationError("Invalid member status");
        billingArray(m.platform_roles).forEach(billingIdentifier);
      });
      if (v.next_cursor !== null) billingIdentifier(v.next_cursor);
    } else if (operation === "admin/subscriptions/query") {
      billingArray(v.subscriptions).forEach((value) => {
        const s = billingObject(value);
        companyId(billingIdentifier(s.company_id));
        billingText(s.display_name);
        billingIdentifier(s.external_workspace_id);
        if (!["NONE", "TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED", "PAST_DUE", "CANCELLED"].includes(String(s.status))) throw new ContractValidationError("Invalid subscription status");
        if (s.subscription_id !== null) billingIdentifier(s.subscription_id);
        nullableDate(s.renewal_cancelled_at);
        if (s.current !== null) period(s.current);
        billingArray(s.periods).forEach(period);
      });
      if (v.next_cursor !== null) billingIdentifier(v.next_cursor);
    } else if (operation === "admin/audit/query") {
      billingArray(v.events).forEach((value) => {
        const e = billingObject(value);
        for (const field of ["audit_log_id", "event_type", "target_type", "target_id", "correlation_id"]) billingIdentifier(e[field]);
        companyId(billingIdentifier(e.company_id));
        if (e.actor_platform_user_id !== null) billingIdentifier(e.actor_platform_user_id);
        billingInstant(e.occurred_at);
      });
      if (v.next_cursor !== null) billingIdentifier(v.next_cursor);
    } else if (operation === "admin/workspace-mode/authorize") {
      billingIdentifier(v.intent_id);
      billingIdentifier(v.external_workspace_id);
      companyId(billingIdentifier(v.target_company_id));
      if (!["observe", "enforce"].includes(String(v.target_mode))) throw new ContractValidationError("Invalid mode");
      billingInstant(v.expires_at);
    } else if (operation === "admin/workspace-mode/applied") {
      billingIdentifier(v.intent_id);
      if (v.applied !== true) throw new ContractValidationError("Mode not applied");
    } else if (operation.endsWith("/reverse")) {
      billingIdentifier(v.reversal_id);
      nullableDate(v.effective_until);
    } else if (/\/(?:retire|disable|role)$/.test(operation)) {
      if (v.ok !== true) throw new ContractValidationError("Operation not applied");
    } else if (/\/(?:create|reports|cancel|confirm|reject)$/.test(operation)) {
      if (v.order === void 0) throw new ContractValidationError("Missing order");
      if (operation.endsWith("/reports")) billingIdentifier(v.report_id);
      if (operation.endsWith("/confirm") && v.period === void 0) throw new ContractValidationError("Missing confirmed period");
    } else if (/\/(?:start-trial|activate-free)$/.test(operation)) {
      if (v.period === void 0) throw new ContractValidationError("Missing activation period");
    } else throw new ContractValidationError("Unknown billing operation");
    return v;
  }
  class SubscriptionDirectoryContractValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = "SubscriptionDirectoryContractValidationError";
    }
  }
  function record$1(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new SubscriptionDirectoryContractValidationError(`${label} must be an object`);
    }
    return value;
  }
  function nonEmptyString$1(value, label) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new SubscriptionDirectoryContractValidationError(`${label} must be a non-empty string`);
    }
    return value;
  }
  function timestamp(value, label) {
    const result = nonEmptyString$1(value, label);
    if (Number.isNaN(Date.parse(result))) {
      throw new SubscriptionDirectoryContractValidationError(`${label} must be an ISO timestamp`);
    }
    return result;
  }
  function optionalTimestamp(value, label) {
    if (value === void 0) return void 0;
    return timestamp(value, label);
  }
  function enumValue(value, label, values) {
    if (typeof value !== "string" || !values.includes(value)) {
      throw new SubscriptionDirectoryContractValidationError(`${label} is unsupported`);
    }
    return value;
  }
  function parseSubscriptionDirectoryResponse(input) {
    const value = record$1(input, "response");
    if (!Array.isArray(value.subscriptions)) {
      throw new SubscriptionDirectoryContractValidationError("subscriptions must be an array");
    }
    const seen = /* @__PURE__ */ new Set();
    const subscriptions = value.subscriptions.map((item, index) => {
      const subscription = record$1(item, `subscriptions[${index}]`);
      const subscriptionId = nonEmptyString$1(subscription.subscription_id, `subscriptions[${index}].subscription_id`);
      if (seen.has(subscriptionId)) {
        throw new SubscriptionDirectoryContractValidationError(`subscriptions[${index}].subscription_id is duplicated`);
      }
      seen.add(subscriptionId);
      const endsAt = optionalTimestamp(subscription.ends_at, `subscriptions[${index}].ends_at`);
      return {
        subscription_id: subscriptionId,
        company_id: nonEmptyString$1(subscription.company_id, `subscriptions[${index}].company_id`),
        product_id: nonEmptyString$1(subscription.product_id, `subscriptions[${index}].product_id`),
        plan_id: nonEmptyString$1(subscription.plan_id, `subscriptions[${index}].plan_id`),
        plan_version_id: nonEmptyString$1(subscription.plan_version_id, `subscriptions[${index}].plan_version_id`),
        status: enumValue(subscription.status, `subscriptions[${index}].status`, ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"]),
        starts_at: timestamp(subscription.starts_at, `subscriptions[${index}].starts_at`),
        ...endsAt !== void 0 ? { ends_at: endsAt } : {}
      };
    });
    return {
      request_id: nonEmptyString$1(value.request_id, "request_id"),
      subscriptions
    };
  }
  class CompanySubscriptionContractValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = "CompanySubscriptionContractValidationError";
    }
  }
  function record(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CompanySubscriptionContractValidationError(`${label} must be an object`);
    }
    return value;
  }
  function nonEmptyString(value, label) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new CompanySubscriptionContractValidationError(`${label} must be a non-empty string`);
    }
    return value;
  }
  function parseCompanySubscriptionDirectoryResponse(input) {
    const value = record(input, "response");
    const requestId = nonEmptyString(value.request_id, "request_id");
    const companyId2 = nonEmptyString(value.company_id, "company_id");
    let subscriptions;
    try {
      subscriptions = parseSubscriptionDirectoryResponse({
        request_id: requestId,
        subscriptions: value.subscriptions
      }).subscriptions;
    } catch (error) {
      throw new CompanySubscriptionContractValidationError(error instanceof Error ? error.message : "Invalid subscriptions");
    }
    for (const [index, subscription] of subscriptions.entries()) {
      if (subscription.company_id !== companyId2) {
        throw new CompanySubscriptionContractValidationError(`subscriptions[${index}].company_id must match company_id`);
      }
    }
    return { request_id: requestId, company_id: companyId2, subscriptions };
  }
  function productAccessIdentifier(input) {
    if (typeof input !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(input)) {
      throw new ContractValidationError("Invalid product access identifier");
    }
    return input;
  }
  function instant(input) {
    if (typeof input !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(input) || !Number.isFinite(Date.parse(input))) {
      throw new ContractValidationError("Invalid product access timestamp");
    }
    return input;
  }
  function parseProductAccessResponse(input) {
    var _a;
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new ContractValidationError("Invalid access snapshot");
    const value = input;
    const request_id = productAccessIdentifier(value.request_id);
    const company_id = productAccessIdentifier(value.company_id);
    const product_id = productAccessIdentifier(value.product_id);
    const external_company_id = productAccessIdentifier(
      value.external_company_id
    );
    const evaluated_at = instant(value.evaluated_at);
    const expires_at = instant(value.expires_at);
    const evaluated = Date.parse(evaluated_at);
    const expiry = Date.parse(expires_at);
    if (expiry <= evaluated || expiry > evaluated + 3e4)
      throw new ContractValidationError("Invalid grant validity");
    if (!Array.isArray(value.subscriptions) || value.subscriptions.length > 100 || !Array.isArray(value.entitlements) || value.entitlements.length > 1e3)
      throw new ContractValidationError("Invalid access resource count");
    const subscriptions = parseCompanySubscriptionDirectoryResponse({
      request_id,
      company_id,
      subscriptions: value.subscriptions
    }).subscriptions;
    const ids = /* @__PURE__ */ new Set();
    const active = [];
    for (const subscription of subscriptions) {
      if (subscription.product_id !== product_id || ids.has(subscription.subscription_id))
        throw new ContractValidationError("Invalid subscription scope");
      for (const id of [
        subscription.subscription_id,
        subscription.plan_id,
        subscription.plan_version_id
      ])
        productAccessIdentifier(id);
      ids.add(subscription.subscription_id);
      const starts = Date.parse(instant(subscription.starts_at));
      const ends = subscription.ends_at === void 0 ? Infinity : Date.parse(instant(subscription.ends_at));
      if (ends < starts || ends === starts && !["CANCELLED", "EXPIRED"].includes(subscription.status))
        throw new ContractValidationError("Invalid subscription interval");
      if (["TRIAL", "ACTIVE"].includes(subscription.status) && starts <= evaluated && evaluated < ends) {
        active.push(subscription);
        if (expiry > ends)
          throw new ContractValidationError("Grant outlives subscription");
      }
    }
    if (active.length > 1)
      throw new ContractValidationError("Ambiguous effective subscriptions");
    const entitlements = parseEntitlementsResponse({
      request_id,
      company_id,
      product_id,
      evaluated_at,
      entitlements: value.entitlements
    }).entitlements;
    const codes = /* @__PURE__ */ new Set();
    for (const entitlement of entitlements) {
      const subscription = active.find(
        (item) => item.subscription_id === entitlement.subscription_id && item.plan_id === entitlement.plan_id
      );
      if (!subscription || codes.has(entitlement.code))
        throw new ContractValidationError(
          "Invalid effective entitlement reference"
        );
      codes.add(entitlement.code);
      productAccessIdentifier(entitlement.definition_id);
      if (entitlement.code === "rental.rooms.max" && (entitlement.value_type !== "INTEGER" || typeof entitlement.value !== "number" || !Number.isSafeInteger(entitlement.value) || entitlement.value < 0))
        throw new ContractValidationError("Invalid room capacity");
      if (entitlement.code === "rental.workspace.enabled" && (entitlement.value_type !== "BOOLEAN" || typeof entitlement.value !== "boolean"))
        throw new ContractValidationError("Invalid rental permission");
      if (entitlement.code === "rental.rooms.unlimited" && (entitlement.value_type !== "BOOLEAN" || entitlement.value !== true))
        throw new ContractValidationError("Invalid unlimited capacity");
    }
    if (codes.has("rental.rooms.max") && codes.has("rental.rooms.unlimited")) throw new ContractValidationError("Conflicting room capacity");
    const commercialState = value.commercial_state;
    if (commercialState !== void 0 && (typeof commercialState !== "string" || !["NONE", "TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"].includes(commercialState))) throw new ContractValidationError("Invalid commercial state");
    const commercialActive = ["ACTIVE", "TRIAL"].includes(String(commercialState));
    if (commercialActive && (active.length !== 1 || ((_a = active[0]) == null ? void 0 : _a.status) !== commercialState)) throw new ContractValidationError("Invalid commercial subscription");
    if (commercialState !== void 0 && !commercialActive && (active.length || entitlements.length)) throw new ContractValidationError("Inactive commercial grant");
    if ((commercialActive || entitlements.some((e) => e.source === "subscription_period")) && (!codes.has("rental.rooms.max") && !codes.has("rental.rooms.unlimited") || !entitlements.some((e) => e.code === "rental.workspace.enabled" && e.value === true)))
      throw new ContractValidationError("Missing commercial room configuration");
    return {
      request_id,
      company_id,
      product_id,
      external_company_id,
      evaluated_at,
      expires_at,
      subscriptions,
      entitlements,
      ...commercialState === void 0 ? {} : { commercial_state: commercialState }
    };
  }
  exports.bankInstructionToDto = bankInstructionToDto;
  exports.billingBody = billingBody;
  exports.billingIdentifier = billingIdentifier;
  exports.billingInstant = billingInstant;
  exports.billingObject = billingObject;
  exports.billingOperationPatterns = billingOperationPatterns;
  exports.billingOrderDetailsToDto = billingOrderDetailsToDto;
  exports.billingOrderToDto = billingOrderToDto;
  exports.billingPeriodToDto = billingPeriodToDto;
  exports.billingRequestFields = billingRequestFields;
  exports.commercialPlanToDto = commercialPlanToDto;
  exports.commercialTermsToDto = commercialTermsToDto;
  exports.isBillingOperation = isBillingOperation;
  exports.parseBillingEnvelope = parseBillingEnvelope;
  exports.parseBillingOperationResponse = parseBillingOperationResponse;
  exports.parseBillingOrderDto = parseBillingOrderDto;
  exports.parseBillingOrderResponse = parseBillingOrderResponse;
  exports.parseBillingPeriodDto = parseBillingPeriodDto;
  exports.parseCommercialPlanDto = parseCommercialPlanDto;
  exports.parseCommercialTermsDto = parseCommercialTermsDto;
  exports.parseProductAccessResponse = parseProductAccessResponse;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
