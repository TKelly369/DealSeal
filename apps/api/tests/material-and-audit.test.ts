import { describe, expect, it } from "vitest";
import {
  classifyBuyerMaterial,
  classifyFinancialMaterial,
  classifyVehicleMaterial,
} from "../src/services/transaction-material-classifier.js";
import {
  decodeAuditCursor,
  encodeAuditCursor,
} from "../src/services/audit-read-service.js";

describe("material classifiers", () => {
  it("treats first buyer write as material", () => {
    expect(
      classifyBuyerMaterial(null, {
        legalName: "A",
        dob: null,
        addressJson: {},
        identifiersJson: {},
      }),
    ).toBe(true);
  });

  it("treats address-only change as non-material", () => {
    const before = {
      legalName: "A",
      dob: null,
      addressJson: { line1: "1" },
      identifiersJson: {},
    };
    expect(
      classifyBuyerMaterial(before, {
        ...before,
        addressJson: { line1: "2" },
      }),
    ).toBe(false);
  });

  it("treats VIN change as material vehicle", () => {
    const before = {
      vin: "1",
      year: 2020,
      make: "M",
      model: "X",
      trim: "t",
      mileage: 1,
      rawJson: {},
    };
    expect(
      classifyVehicleMaterial(before, {
        ...before,
        vin: "2",
      }),
    ).toBe(true);
  });

  it("treats trim-only as non-material vehicle", () => {
    const before = {
      vin: "1",
      year: 2020,
      make: "M",
      model: "X",
      trim: "t",
      mileage: 1,
      rawJson: {},
    };
    expect(
      classifyVehicleMaterial(before, {
        ...before,
        trim: "z",
      }),
    ).toBe(false);
  });

  it("treats amount change as material financial", () => {
    const before = {
      amountFinanced: 100,
      aprBps: 100,
      termMonths: 60,
      paymentJson: {},
      lenderCode: "L",
    };
    expect(
      classifyFinancialMaterial(before, {
        ...before,
        amountFinanced: 200,
      }),
    ).toBe(true);
  });
});

describe("audit cursor", () => {
  it("roundtrips audit search cursor", () => {
    const t = new Date("2026-01-02T03:04:05.000Z");
    const id = "abc";
    const enc = encodeAuditCursor(t, id);
    const dec = decodeAuditCursor(enc);
    expect(dec).toEqual({ t: t.toISOString(), id });
  });
});
