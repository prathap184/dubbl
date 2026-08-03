import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { 
  invoice, payment, bill, expenseClaim, journalEntry, 
  creditNote, debitNote, bankTransaction, customerCredit
} from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const url = new URL(request.url);
    const dateStr = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    const startOfDay = new Date(dateStr + "T00:00:00.000Z");
    const dateOnlyStr = startOfDay.toISOString().split("T")[0];

    // ── 1. Opening Cash & Bank Balance Query ────────────────────────────────
    let openingBalance = 0;
    try {
      const [openingRow] = await db
        .select({
          total: sql<number>`coalesce(sum(${bankTransaction.amount}), 0)`.mapWith(Number),
        })
        .from(bankTransaction)
        .where(
          and(
            eq(bankTransaction.organizationId, ctx.organizationId),
            lte(bankTransaction.transactionDate, new Date(startOfDay.getTime() - 86400000).toISOString().split("T")[0]),
            isNull(bankTransaction.deletedAt)
          )
        );
      openingBalance = (openingRow?.total || 0) / 100;
    } catch {
      openingBalance = 0;
    }

    // ── 2. Parallel Queries for Selected Date ────────────────────────────────
    const [
      invoices,
      payments,
      prepayments,
      expenses,
      bills,
      creditNotes,
      debitNotes,
      entries,
    ] = await Promise.all([
      db.query.invoice.findMany({
        where: and(
          eq(invoice.organizationId, ctx.organizationId),
          gte(invoice.issueDate, dateOnlyStr),
          lte(invoice.issueDate, dateOnlyStr),
          isNull(invoice.deletedAt)
        ),
        with: { contact: true, lines: true },
      }),
      db.query.payment.findMany({
        where: and(
          eq(payment.organizationId, ctx.organizationId),
          gte(payment.paymentDate, dateOnlyStr),
          lte(payment.paymentDate, dateOnlyStr),
          isNull(payment.deletedAt)
        ),
        with: { contact: true },
      }),
      db.query.customerCredit.findMany({
        where: and(
          eq(customerCredit.organizationId, ctx.organizationId),
          gte(customerCredit.date, dateOnlyStr),
          lte(customerCredit.date, dateOnlyStr),
          isNull(customerCredit.deletedAt)
        ),
        with: { contact: true },
      }),
      db.query.expenseClaim.findMany({
        where: and(
          eq(expenseClaim.organizationId, ctx.organizationId),
          gte(expenseClaim.createdAt, startOfDay),
          isNull(expenseClaim.deletedAt)
        ),
      }),
      db.query.bill.findMany({
        where: and(
          eq(bill.organizationId, ctx.organizationId),
          gte(bill.issueDate, dateOnlyStr),
          lte(bill.issueDate, dateOnlyStr),
          isNull(bill.deletedAt)
        ),
        with: { contact: true, lines: true },
      }),
      db.query.creditNote.findMany({
        where: and(
          eq(creditNote.organizationId, ctx.organizationId),
          gte(creditNote.issueDate, dateOnlyStr),
          lte(creditNote.issueDate, dateOnlyStr),
          isNull(creditNote.deletedAt)
        ),
        with: { contact: true, lines: true },
      }),
      db.query.debitNote.findMany({
        where: and(
          eq(debitNote.organizationId, ctx.organizationId),
          gte(debitNote.issueDate, dateOnlyStr),
          lte(debitNote.issueDate, dateOnlyStr),
          isNull(debitNote.deletedAt)
        ),
        with: { contact: true, lines: true },
      }),
      db.query.journalEntry.findMany({
        where: and(
          eq(journalEntry.organizationId, ctx.organizationId),
          gte(journalEntry.date, dateOnlyStr),
          lte(journalEntry.date, dateOnlyStr),
          isNull(journalEntry.deletedAt)
        ),
        with: { lines: true },
      }),
    ]);

    // ── 3. Normalization Engine with Double-Entry & Multi-Currency Rules ──
    const records: any[] = [];

    // Sales Invoices
    for (const inv of invoices) {
      const rate = inv.exchangeRate ? Number(inv.exchangeRate) : 1;
      const grossTotal = (inv.total / 100) * rate;
      const isVoid = inv.status === "void";

      records.push({
        id: inv.id,
        timestamp: new Date(inv.createdAt).getTime(),
        date: inv.issueDate,
        voucherType: "Sales Invoice",
        voucherNo: inv.invoiceNumber,
        partyName: inv.contact?.name || "Guest Customer",
        debitAmount: isVoid ? 0 : grossTotal, // Debit Customer AR
        creditAmount: 0,
        status: inv.status,
        isVoid,
        notes: inv.notes || null,
        taxDetails: { 
          cgst: ((inv.cgstTotal || 0) / 100) * rate, 
          sgst: ((inv.sgstTotal || 0) / 100) * rate, 
          igst: ((inv.igstTotal || 0) / 100) * rate 
        },
        items: inv.lines?.map((l: any) => ({
          description: l.description,
          quantity: (l.quantity || 100) / 100,
          unitPrice: ((l.unitPrice || 0) / 100) * rate,
          amount: ((l.amount || 0) / 100) * rate,
          width: l.width || 0,
          length: l.length || 0,
        })),
        link: `/sales/${inv.id}`,
      });
    }

    // Customer Receipts
    for (const pay of payments) {
      const rate = pay.exchangeRate ? Number(pay.exchangeRate) : 1;
      const amt = (pay.amount / 100) * rate;
      const isVoid = pay.status === "void";

      records.push({
        id: pay.id,
        timestamp: new Date(pay.createdAt).getTime(),
        date: pay.paymentDate,
        voucherType: `Receipt (${pay.paymentMethod || 'Bank'})`,
        voucherNo: pay.paymentNumber,
        partyName: pay.contact?.name || "Customer",
        debitAmount: isVoid ? 0 : amt, // Debit Bank / Cash
        creditAmount: 0,
        status: pay.status,
        isVoid,
        notes: pay.reference || null,
        taxDetails: { cgst: 0, sgst: 0, igst: 0 },
        items: [],
        link: `/sales/payments/${pay.id}`,
      });
    }

    // Customer Prepayments / Deposits
    for (const cp of prepayments) {
      const rate = cp.exchangeRate ? Number(cp.exchangeRate) : 1;
      const amt = ((cp.amountRemaining || cp.amount || 0) / 100) * rate;
      const isVoid = cp.status === "void";

      records.push({
        id: cp.id,
        timestamp: new Date(cp.createdAt).getTime(),
        date: cp.date,
        voucherType: `Prepayment (${cp.paymentMethod || 'Customer Deposit'})`,
        voucherNo: cp.creditNumber || "PREPAY",
        partyName: cp.contact?.name || "Customer",
        debitAmount: isVoid ? 0 : amt, // Debit Cash/Bank
        creditAmount: 0,
        status: cp.status || "posted",
        isVoid,
        notes: cp.notes || null,
        taxDetails: { cgst: 0, sgst: 0, igst: 0 },
        items: [],
        link: `/sales/customer-prepayments/${cp.id}`,
      });
    }

    // Expenses & Vendor Payments
    for (const exp of expenses) {
      const amt = (exp.totalAmount / 100);
      const isVoid = exp.status === "rejected";

      records.push({
        id: exp.id,
        timestamp: new Date(exp.createdAt).getTime(),
        date: dateOnlyStr,
        voucherType: "Expense Claim",
        voucherNo: exp.title || "EXPENSE",
        partyName: exp.description || "Employee Expense",
        debitAmount: 0,
        creditAmount: isVoid ? 0 : amt, // Credit Cash / Bank
        status: exp.status,
        isVoid,
        notes: exp.description || null,
        taxDetails: { cgst: 0, sgst: 0, igst: 0 },
        items: [],
        link: `/purchases/expenses`,
      });
    }

    // Vendor Bills (Purchases)
    for (const b of bills) {
      const rate = b.exchangeRate ? Number(b.exchangeRate) : 1;
      const amt = (b.total / 100) * rate;
      const isVoid = b.status === "void";

      records.push({
        id: b.id,
        timestamp: new Date(b.createdAt).getTime(),
        date: b.issueDate,
        voucherType: "Purchase Bill",
        voucherNo: b.billNumber,
        partyName: b.contact?.name || "Supplier",
        debitAmount: 0,
        creditAmount: isVoid ? 0 : amt, // Credit Vendor AP
        status: b.status,
        isVoid,
        notes: b.notes || null,
        taxDetails: { 
          cgst: ((b.cgstTotal || 0) / 100) * rate, 
          sgst: ((b.sgstTotal || 0) / 100) * rate, 
          igst: ((b.igstTotal || 0) / 100) * rate 
        },
        items: b.lines?.map((l: any) => ({
          description: l.description,
          quantity: (l.quantity || 100) / 100,
          unitPrice: ((l.unitPrice || 0) / 100) * rate,
          amount: ((l.amount || 0) / 100) * rate,
        })),
        link: `/purchases/${b.id}`,
      });
    }

    // Credit Notes (Sales Returns)
    for (const cn of creditNotes) {
      const rate = cn.exchangeRate ? Number(cn.exchangeRate) : 1;
      const amt = (cn.total / 100) * rate;
      const isVoid = cn.status === "void";

      records.push({
        id: cn.id,
        timestamp: new Date(cn.createdAt).getTime(),
        date: cn.issueDate,
        voucherType: "Credit Note",
        voucherNo: cn.creditNoteNumber,
        partyName: cn.contact?.name || "Customer",
        debitAmount: 0,
        creditAmount: isVoid ? 0 : amt, // Credit Customer AR
        status: cn.status,
        isVoid,
        notes: cn.notes || null,
        taxDetails: { 
          cgst: ((cn.cgstTotal || 0) / 100) * rate, 
          sgst: ((cn.sgstTotal || 0) / 100) * rate, 
          igst: ((cn.igstTotal || 0) / 100) * rate 
        },
        items: cn.lines?.map((l: any) => ({
          description: l.description,
          quantity: (l.quantity || 100) / 100,
          unitPrice: ((l.unitPrice || 0) / 100) * rate,
          amount: ((l.amount || 0) / 100) * rate,
        })),
        link: `/sales/credit-notes/${cn.id}`,
      });
    }

    // Debit Notes (Purchase Returns)
    for (const dn of debitNotes) {
      const rate = dn.exchangeRate ? Number(dn.exchangeRate) : 1;
      const amt = (dn.total / 100) * rate;
      const isVoid = dn.status === "void";

      records.push({
        id: dn.id,
        timestamp: new Date(dn.createdAt).getTime(),
        date: dn.issueDate,
        voucherType: "Debit Note",
        voucherNo: dn.debitNoteNumber,
        partyName: dn.contact?.name || "Supplier",
        debitAmount: isVoid ? 0 : amt, // Debit Vendor AP
        creditAmount: 0,
        status: dn.status,
        isVoid,
        notes: dn.notes || null,
        taxDetails: { 
          cgst: ((dn.cgstTotal || 0) / 100) * rate, 
          sgst: ((dn.sgstTotal || 0) / 100) * rate, 
          igst: ((dn.igstTotal || 0) / 100) * rate 
        },
        items: dn.lines?.map((l: any) => ({
          description: l.description,
          quantity: (l.quantity || 100) / 100,
          unitPrice: ((l.unitPrice || 0) / 100) * rate,
          amount: ((l.amount || 0) / 100) * rate,
        })),
        link: `/purchases/debit-notes/${dn.id}`,
      });
    }

    // Journal & Contra Entries
    for (const ent of entries) {
      records.push({
        id: ent.id,
        timestamp: new Date(ent.createdAt).getTime(),
        date: ent.date,
        voucherType: "Journal Entry",
        voucherNo: ent.entryNumber,
        partyName: ent.description || "General Adjustment",
        debitAmount: (ent.totalDebit || 0) / 100,
        creditAmount: (ent.totalCredit || 0) / 100,
        status: ent.status || "posted",
        isVoid: ent.status === "void",
        notes: ent.description || null,
        taxDetails: { cgst: 0, sgst: 0, igst: 0 },
        items: ent.lines?.map((l: any) => ({
          description: l.description || "Ledger Line",
          amount: (l.debit || l.credit || 0) / 100,
        })),
        link: `/accounting/entries/${ent.id}`,
      });
    }

    // Chronological Sort
    records.sort((a, b) => b.timestamp - a.timestamp);

    // Calculate Net Daily Totals (excluding voided / draft)
    const activeRecords = records.filter(r => !r.isVoid && r.status !== 'draft');
    const totalDebits = activeRecords.reduce((sum, r) => sum + r.debitAmount, 0);
    const totalCredits = activeRecords.reduce((sum, r) => sum + r.creditAmount, 0);
    const closingBalance = openingBalance + totalDebits - totalCredits;

    return NextResponse.json({
      date: dateOnlyStr,
      openingBalance,
      closingBalance,
      summary: {
        totalDebits,
        totalCredits,
        netFlow: totalDebits - totalCredits,
        totalVouchers: records.length,
      },
      records,
    });
  } catch (err) {
    return handleError(err);
  }
}
