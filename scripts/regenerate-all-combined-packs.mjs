/**
 * Regenerates Combined Loan Pack PDFs for loans where:
 *   - combined_loan_pack.file_path is an old Supabase path (not R2)
 *   - AND signed_document_path is null OR also an old path not in R2
 *
 * Skips loans where a valid signed document already exists in R2.
 * Uploads regenerated PDFs to R2 and updates DB.
 */

import puppeteer from 'puppeteer';
import { AwsClient } from 'aws4fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';
const R2_ACCOUNT_ID = 'd58b54ae5a23bd00df9ff399e1e34c0e';
const R2_ACCESS_KEY_ID = '895145c9b16c145e9bab27589e5bd9ec';
const R2_SECRET_ACCESS_KEY = 'b7673c0ed50c019642f758fc0d34a01d65c1ec55ab19dd7cc87aa92b4b0be117';
const R2_BUCKET = 'paisaasaarthi';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_BASE = 'https://pub-45f68799e99e40dba88b93e0f65da4bc.r2.dev';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3' });

const isR2 = v => v && v.startsWith(R2_PUBLIC_BASE);

async function existsInR2(url) {
  const res = await fetch(url, { method: 'HEAD' });
  return res.ok;
}

async function uploadToR2(key, buffer) {
  const res = await r2.fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(buffer.length) },
    body: buffer,
  });
  if (!res.ok) throw new Error(`R2 upload failed [${res.status}]: ${await res.text()}`);
  return `${R2_PUBLIC_BASE}/${key}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = n => `Rs.${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`;

function fmtDate(d, style = 'long') {
  if (!d) return 'N/A';
  const date = d instanceof Date ? d : new Date(d);
  const opts = style === 'long'
    ? { day: '2-digit', month: 'long', year: 'numeric' }
    : style === 'short'
    ? { day: '2-digit', month: 'short', year: 'numeric' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return date.toLocaleDateString('en-IN', opts);
}

function addDays(d, n) {
  const r = new Date(d instanceof Date ? d : new Date(d));
  r.setDate(r.getDate() + n);
  return r;
}

function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num === 0) return 'Zero';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: white; }
  .page { padding: 20px 24px; max-width: 794px; margin: 0 auto; }
  .page-break { page-break-before: always; }
  h2 { font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; }
  h3 { font-size: 12px; font-weight: bold; color: #01B8AA; border-bottom: 1px solid #01B8AA; padding-bottom: 3px; margin: 12px 0 6px; }
  h4 { font-size: 11px; font-weight: bold; margin: 10px 0 5px; }
  p { margin-bottom: 6px; line-height: 1.5; }
  ul, ol { padding-left: 18px; margin-bottom: 6px; }
  li { margin-bottom: 3px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #ddd; padding: 5px 7px; font-size: 11px; }
  thead { background: #01B8AA; color: white; }
  .bg-muted { background: #f5f5f5; }
  .font-bold { font-weight: bold; }
  .text-primary { color: #01B8AA; }
  .text-muted { color: #666; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .notice { background: #e6f7f5; border: 1px solid #a3dbd6; border-radius: 4px; padding: 8px; margin-bottom: 10px; }
  .warn { background: #fff3f3; border: 1px solid #ffcccc; border-radius: 4px; padding: 8px; margin-bottom: 10px; }
  .header { border-bottom: 2px solid #01B8AA; padding-bottom: 8px; margin-bottom: 14px; }
  .header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
  .company-name { font-size: 16px; font-weight: bold; color: #01B8AA; }
  .doc-title { font-size: 13px; font-weight: bold; text-align: center; margin: 6px 0; text-transform: uppercase; letter-spacing: 1px; }
  .doc-meta { font-size: 10px; color: #555; }
  .sig-block { border-top: 1px solid #111; padding-top: 4px; width: 180px; margin-top: 30px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid2-span { grid-column: span 2; }
  .odd-row { background: #fafafa; }
  .due-row { font-weight: bold; background: #e6f7f5; }
`;

function docHeader(companyName, title, docNumber, docDate) {
  return `
  <div class="header">
    <div class="header-flex">
      <div>
        <div class="company-name">${companyName}</div>
        <div class="doc-meta">Paisaa Saarthi Fintech Pvt Ltd</div>
      </div>
      <div style="text-align:right">
        <div class="doc-meta">Doc No: <strong>${docNumber}</strong></div>
        <div class="doc-meta">Date: <strong>${fmtDate(docDate, 'long')}</strong></div>
      </div>
    </div>
    <div class="doc-title">${title}</div>
  </div>`;
}

function generateHTML(d) {
  const cn = d.companyName;
  const docDate = new Date(d.documentDate);
  const dueDate = new Date(d.dueDate);
  const disbDate = new Date(d.disbursementDate);
  const validUntil = new Date(d.validUntil);
  const dailyInterest = d.loanAmount * (d.interestRate / 100);
  const maturityDate = addDays(disbDate, d.tenureDays);
  const totalCost = d.totalInterest + d.processingFee + d.gstOnProcessingFee;
  const apr = ((totalCost / d.netDisbursal) / (d.tenureDays / 365)) * 100;

  const terms = [
    'The loan is granted subject to the accuracy of information and documents provided.',
    'The interest shall accrue from the date of disbursement.',
    'Repayment must be made in full on or before the due date.',
    'Late payment will attract penal interest as per the loan agreement.',
    'The sanction is non-transferable and cannot be used as collateral.',
    'The lender reserves the right to recall the loan in case of any misrepresentation.',
    'This sanction is subject to KYC norms and RBI guidelines.',
  ];

  // Sanction Letter
  const sanctionLetter = `
  <div class="page">
    ${docHeader(cn, 'LOAN SANCTION LETTER', d.sanctionDocNumber, docDate)}
    <p><strong>To,</strong></p>
    <p class="font-bold" style="font-size:13px">${d.borrowerName}</p>
    <p class="text-muted">${d.borrowerAddress}</p><br>
    <p><strong>Subject:</strong> Sanction of Personal Loan – Reference No. ${d.sanctionDocNumber}</p>
    <p>Dear ${d.borrowerName.split(' ')[0]},</p>
    <p>We are pleased to inform you that your application for a Personal Loan has been <strong class="text-primary">APPROVED</strong>. Based on our assessment and subject to the terms and conditions mentioned herein, we are sanctioning a loan as per the following details:</p>
    <table><tbody>
      <tr><td class="bg-muted font-bold" width="50%">Loan Amount Sanctioned</td><td><strong style="font-size:13px">${fmt(d.loanAmount)}</strong><br><small class="text-muted">(Rupees ${numberToWords(d.loanAmount)} Only)</small></td></tr>
      <tr><td class="bg-muted">Rate of Interest</td><td>${d.interestRate}% per day (Flat)</td></tr>
      <tr><td class="bg-muted">Loan Tenure</td><td>${d.tenureDays} Days</td></tr>
      <tr><td class="bg-muted">Total Interest</td><td>${fmt(d.totalInterest)}</td></tr>
      <tr><td class="bg-muted font-bold">Total Repayment Amount</td><td><strong>${fmt(d.totalRepayment)}</strong></td></tr>
      <tr><td class="bg-muted">Due Date</td><td><strong>${fmtDate(dueDate, 'long')}</strong></td></tr>
      <tr><td class="bg-muted">Processing Fee</td><td>${fmt(d.processingFee)}</td></tr>
      <tr><td class="bg-muted">GST on Processing Fee</td><td>${fmt(d.gstOnProcessingFee)}</td></tr>
      <tr><td class="bg-muted font-bold text-primary">Net Disbursal Amount</td><td><strong class="text-primary">${fmt(d.netDisbursal)}</strong></td></tr>
      <tr><td class="bg-muted">Sanction Validity</td><td style="color:red">Valid until ${fmtDate(validUntil, 'long')}</td></tr>
    </tbody></table>
    <h3>TERMS AND CONDITIONS</h3>
    <ol>${terms.map(t => `<li>${t}</li>`).join('')}</ol>
    <div class="warn"><p style="color:#c00">This sanction is valid until ${fmtDate(validUntil, 'long')}. Please complete the documentation and disbursement formalities before the expiry date.</p></div>
    <p>We thank you for choosing ${cn} and look forward to a long-term relationship.</p>
    <p>Warm regards,</p>
    <div class="grid2" style="margin-top:20px">
      <div><div class="sig-block"><p class="font-bold">For ${cn}</p><p class="text-muted">Authorized Signatory</p></div></div>
    </div>
    <div style="border-top:2px solid #01B8AA;margin-top:30px;padding-top:12px">
      <h4>BORROWER ACCEPTANCE</h4>
      <p class="text-muted">I, ${d.borrowerName}, hereby accept the above sanction and agree to abide by all the terms and conditions mentioned herein.</p>
      <div class="grid2" style="margin-top:20px">
        <div><div class="sig-block"><p class="font-bold">Borrower Signature</p><p class="text-muted">${d.borrowerName}</p></div></div>
        <div><div class="sig-block"><p class="font-bold">Date</p></div></div>
      </div>
    </div>
  </div>`;

  // Loan Agreement
  const loanAgreement = `
  <div class="page page-break">
    ${docHeader(cn, 'LOAN AGREEMENT', d.agreementDocNumber, docDate)}
    <div style="margin-bottom:10px;font-size:11px">
      <p>This loan agreement "Agreement" is entered by electronic means on the day mentioned in the Schedule of Loan Details and Terms of the agreement.</p>
      <h4>BY AND BETWEEN:</h4>
      <p>SKYRISE CREDIT AND MARKETING LIMITED, a duly registered Non-Banking Financial Company registered with the Reserve Bank of India and incorporated in India under Companies Act 1956 with Corporate Identification Number (CIN): U74899DL1993PLC055475 with Corporate office:- Office No 110, H-161, Sector -63, Noida, UP-201301 (hereinafter referred to as the "Lender" of the FIRST PART).</p>
      <p class="text-center font-bold">and</p>
      <p>${d.borrowerName} an Indian resident with Permanent Account Number (PAN): ${d.borrowerPAN || 'N/A'} Address: ${d.borrowerAddress} Phone Number: ${d.borrowerPhone} (hereinafter referred to as the "Borrower" of the SECOND PART).</p>
    </div>
    <h3>Witnesseth</h3>
    <p>Whereas, paisaasaarthi.com is an online loan origination platform of PAISAA SAARTHI FINTECH PVT LTD that markets personal loan products to borrowers. The Lender is a Non-Banking Financial Company engaged in the business to provide loans to individual and business customers in India.</p>
    <h3>1. Commencement</h3>
    <p>This agreement shall come into effect from the date of this agreement as recorded in the Schedule of Loan Details and Terms appended to this agreement.</p>
    <h3>Borrower Acknowledgements and Confirmation</h3>
    <ol>
      <li>I have personally applied for the Loan on the website after confirming acceptance of the terms and conditions.</li>
      <li>I acknowledge that my Name, PAN, Aadhaar details are obtained with my consent.</li>
      <li>I understand the loan terms are approved as per internal policies and credit underwriting process.</li>
      <li>I hereby make a drawdown request of the Loan from the Lender.</li>
    </ol>
    <h3>Borrower Undertaking</h3>
    <p>I represent that the information and details provided by me are true, correct and that I have not withheld any information. I have read and understood the fees and charges applicable to the Loan. I confirm that no insolvency proceedings have been initiated against me. I hereby authorize Lender to share information with associate companies or third parties as required. That the funds shall be used for the purpose specified in the SCHEDULE OF LOAN DETAILS AND TERMS and will not be used for speculative purposes.</p>
    <h3>Representations and Warranties</h3>
    <ul>
      <li>Each party has full power and authority to enter into and perform this agreement.</li>
      <li>Obligations under this agreement are legally binding and enforceable.</li>
      <li>The parties warrant they have the legal competence to execute and perform this agreement.</li>
    </ul>
    <h3>Disbursement of the Loan</h3>
    <p>The Lender will disburse the loan by online means into the bank account of the borrower after acceptance of this agreement.</p>
    <h3>Repayment of the Loan</h3>
    <p>Borrower will repay the required repayment amount in full as mentioned in the Schedule of Loan Details and Terms, on or before the due date without any failure. Borrower undertakes to maintain sufficient balance in the drawee bank account for payment of the eMandate/ENACH on the due date.</p>
    <h3>Events of Default</h3>
    <ul>
      <li>Failure to repay the loan or any fees on the due date; or</li>
      <li>Death of the borrower or becoming insolvent or bankrupt; or</li>
      <li>Any eMandate/ENACH not realized on presentation; or</li>
      <li>Breach of any terms, covenants and conditions herein.</li>
    </ul>
    <h3>Governing Law and Jurisdiction</h3>
    <p>Any dispute shall be settled by the court of law. Jurisdiction – New Delhi, Delhi. This agreement shall be governed by and construed in accordance with the laws of India.</p>
    <h3>SCHEDULE OF LOAN DETAILS AND TERMS</h3>
    <table><tbody>
      <tr><td class="bg-muted" width="10%">1</td><td class="bg-muted" width="40%">Loan ID Number</td><td class="font-bold">${d.agreementDocNumber}</td></tr>
      <tr><td>2</td><td>Agreement Date</td><td>${fmtDate(docDate, 'long')}</td></tr>
      <tr><td>3</td><td>Borrower</td><td>${d.borrowerName}</td></tr>
      <tr><td>4</td><td>Lender</td><td>SKYRISE CREDIT AND MARKETING LIMITED</td></tr>
      <tr><td>7</td><td class="font-bold">Principal Loan Amount</td><td class="font-bold">${fmt(d.loanAmount)}</td></tr>
      <tr><td>8</td><td>Tenure (Days)</td><td>${d.tenureDays} Days</td></tr>
      <tr><td>9</td><td>Rate of Interest</td><td>${d.interestRate.toFixed(2)}% Per Day</td></tr>
      <tr><td>10</td><td>Processing Fees</td><td>${fmt(d.processingFee)}</td></tr>
      <tr><td>12</td><td>GST</td><td>${fmt(d.gstOnProcessingFee)}</td></tr>
      <tr><td>13</td><td class="font-bold text-primary">Amount to be Disbursed</td><td class="font-bold text-primary">${fmt(d.netDisbursal)}</td></tr>
      <tr><td>14</td><td>Due Date</td><td class="font-bold">${fmtDate(dueDate, 'long')}</td></tr>
      <tr><td>15</td><td>Repayment Amount</td><td class="font-bold">${fmt(d.totalRepayment)}</td></tr>
    </tbody></table>
    <p>IN WHEREOF the Parties have executed this Agreement as of (${fmtDate(docDate, 'numeric')}).</p>
    <div class="grid2" style="margin-top:20px">
      <div><p class="font-bold">For SKYRISE CREDIT AND MARKETING LIMITED.</p><div class="sig-block"><p class="text-muted">Authorized Signatory</p></div></div>
      <div><p class="font-bold">Signature of the Applicant</p><div class="sig-block"><p>Name: ______${d.borrowerName}__________</p><p class="text-muted" style="font-size:10px">Specimen Signature/ESIGN Impression</p></div></div>
    </div>
  </div>`;

  // Daily Schedule
  let scheduleRows = '';
  for (let i = 1; i <= d.tenureDays; i++) {
    const date = addDays(disbDate, i);
    const interestAccrued = Math.round(dailyInterest * i);
    const totalDue = d.loanAmount + interestAccrued;
    const cls = i === d.tenureDays ? 'due-row' : i % 2 === 0 ? '' : 'odd-row';
    scheduleRows += `<tr class="${cls}"><td>${i}</td><td>${fmtDate(date, 'short')}</td><td class="text-right">${fmt(Math.round(dailyInterest))}</td><td class="text-right">${fmt(interestAccrued)}</td><td class="text-right">${fmt(totalDue)}</td></tr>`;
  }

  const dailySchedule = `
  <div class="page page-break">
    ${docHeader(cn, 'DAILY REPAYMENT SCHEDULE', d.scheduleDocNumber, docDate)}
    <div class="notice"><p>This document shows the total amount payable if the loan is repaid on any given day. Interest accrues daily at ${d.interestRate}% of the principal. Full repayment due on <strong>${fmtDate(maturityDate, 'long')}</strong>.</p></div>
    <h3>1. BORROWER INFORMATION</h3>
    <div class="grid2">
      <div><span class="text-muted">Borrower Name:</span> <strong>${d.borrowerName}</strong></div>
      <div><span class="text-muted">Phone:</span> <strong>${d.borrowerPhone}</strong></div>
      <div class="grid2-span"><span class="text-muted">Address:</span> ${d.borrowerAddress}</div>
    </div>
    <h3>2. LOAN SUMMARY</h3>
    <table><tbody>
      <tr><td class="bg-muted" width="50%">Loan Principal Amount</td><td class="font-bold">${fmt(d.loanAmount)}</td></tr>
      <tr><td class="bg-muted">Daily Interest Rate</td><td>${d.interestRate}% per day (Flat)</td></tr>
      <tr><td class="bg-muted">Daily Interest Amount</td><td>${fmt(Math.round(dailyInterest))}</td></tr>
      <tr><td class="bg-muted">Loan Tenure</td><td>${d.tenureDays} Days</td></tr>
      <tr><td class="bg-muted">Total Interest Payable</td><td>${fmt(d.totalInterest)}</td></tr>
      <tr><td class="bg-muted font-bold">Total Amount Repayable</td><td class="font-bold">${fmt(d.totalRepayment)}</td></tr>
      <tr><td class="bg-muted">Disbursement Date</td><td>${fmtDate(disbDate, 'long')}</td></tr>
      <tr><td class="bg-muted">Maturity / Due Date</td><td class="font-bold">${fmtDate(maturityDate, 'long')}</td></tr>
    </tbody></table>
    <h3>3. REPAYMENT COLLECTION DETAILS</h3>
    <div style="background:#f5f5f5;border-radius:4px;padding:8px">
      <p><strong>Bank:</strong> ${d.bankName || 'N/A'}</p>
      <p><strong>Account Number:</strong> ${d.accountNumber || 'N/A'}</p>
    </div>
    <h3>4. DAILY INTEREST ACCRUAL SCHEDULE</h3>
    <table>
      <thead><tr><th>Day</th><th>Date</th><th class="text-right">Daily Interest</th><th class="text-right">Interest Accrued</th><th class="text-right">Total Amount Due</th></tr></thead>
      <tbody>
        ${scheduleRows}
        <tr style="background:#e6f7f5;font-weight:bold;border-top:2px solid #01B8AA">
          <td colspan="2">TOTAL ON MATURITY</td>
          <td class="text-right">${fmt(Math.round(dailyInterest))}/day</td>
          <td class="text-right">${fmt(d.totalInterest)}</td>
          <td class="text-right">${fmt(d.totalRepayment)}</td>
        </tr>
      </tbody>
    </table>
    <div style="border-top:2px solid #01B8AA;margin-top:24px;padding-top:12px">
      <h4>BORROWER ACKNOWLEDGMENT</h4>
      <p class="text-muted">I hereby acknowledge that I have received and understood the daily interest accrual schedule and agree to repay the total amount due on the maturity date.</p>
      <div class="grid2" style="margin-top:20px">
        <div><div class="sig-block"><p class="font-bold">Borrower Signature</p><p class="text-muted">${d.borrowerName}</p></div></div>
        <div><div class="sig-block"><p class="font-bold">Date</p><p class="text-muted">${fmtDate(docDate, 'numeric')}</p></div></div>
      </div>
    </div>
  </div>`;

  // KFS
  const kfs = `
  <div class="page page-break">
    ${docHeader(cn, 'KEY FACT STATEMENT (KFS)', d.kfsDocNumber, docDate)}
    <p class="text-muted">As per RBI Circular on Digital Lending dated 02.09.2022, the Key Fact Statement (KFS) is provided to the Borrower prior to execution of the Loan Agreement.</p>
    <h3>ANNEX A – PART 1: INTEREST RATE AND FEES/CHARGES</h3>
    <table><tbody>
      <tr><td class="bg-muted font-bold" width="50%">Loan Sanctioned Amount</td><td class="font-bold">${fmt(d.loanAmount)}</td></tr>
      <tr><td class="bg-muted">Loan Tenure</td><td>${d.tenureDays} Days</td></tr>
      <tr><td class="bg-muted">Number of Instalments</td><td>1 (Bullet Repayment)</td></tr>
      <tr><td class="bg-muted font-bold">Instalment Amount</td><td class="font-bold">${fmt(d.totalRepayment)}</td></tr>
      <tr><td class="bg-muted">Rate of Interest</td><td>${d.interestRate}% Per Day (Flat)</td></tr>
      <tr><td class="bg-muted">Total Interest Charged</td><td>${fmt(d.totalInterest)}</td></tr>
      <tr><td class="bg-muted">Processing Fee</td><td>${fmt(d.processingFee)}</td></tr>
      <tr><td class="bg-muted">GST on Processing Fee</td><td>${fmt(d.gstOnProcessingFee)}</td></tr>
      <tr><td class="bg-muted font-bold text-primary">Net Disbursed Amount</td><td class="font-bold text-primary">${fmt(d.netDisbursal)}</td></tr>
      <tr><td class="bg-muted font-bold">Annual Percentage Rate (APR)</td><td class="font-bold">${apr.toFixed(2)}%</td></tr>
      <tr><td class="bg-muted">Penal/Contingent Charges</td><td>Penal Interest @ ${d.penalInterest}% p.a.; Bounce Charges ${fmt(d.bounceCharges)} per instance + GST</td></tr>
      <tr><td class="bg-muted">Foreclosure/Prepayment Charges</td><td>${d.foreclosureRate}% of outstanding principal + GST</td></tr>
    </tbody></table>
    <h3>ANNEX A – PART 2: QUALITATIVE INFORMATION</h3>
    <table><tbody>
      <tr><td class="bg-muted" width="50%">Recovery Agents Engaged</td><td>As per RBI guidelines, recovery agents (if engaged) will carry proper authorization and follow the Fair Practices Code.</td></tr>
      <tr><td class="bg-muted">Grievance Redressal Officer</td><td>As per company website</td></tr>
      <tr><td class="bg-muted">Nodal Officer / Escalation</td><td>Borrower may escalate to RBI's Integrated Ombudsman Scheme (https://cms.rbi.org.in) if complaint not resolved within 30 days.</td></tr>
      <tr><td class="bg-muted">Cooling-Off / Look-Up Period</td><td>The Borrower may exit the loan within 3 days of disbursement by repaying the principal and proportionate interest, without any penalty.</td></tr>
    </tbody></table>
    <h3>ANNEX C: REPAYMENT SCHEDULE</h3>
    <table>
      <thead><tr><th>Instalment No.</th><th>Due Date</th><th class="text-right">Outstanding Principal</th><th class="text-right">Principal</th><th class="text-right">Interest</th><th class="text-right">Instalment Amount</th></tr></thead>
      <tbody>
        <tr class="font-bold odd-row">
          <td>1</td><td>${fmtDate(dueDate, 'short')}</td>
          <td class="text-right">${fmt(d.loanAmount)}</td><td class="text-right">${fmt(d.loanAmount)}</td>
          <td class="text-right">${fmt(d.totalInterest)}</td><td class="text-right">${fmt(d.totalRepayment)}</td>
        </tr>
        <tr style="background:#e6f7f5;font-weight:bold;border-top:1px solid #01B8AA">
          <td colspan="3">TOTAL</td>
          <td class="text-right">${fmt(d.loanAmount)}</td><td class="text-right">${fmt(d.totalInterest)}</td><td class="text-right">${fmt(d.totalRepayment)}</td>
        </tr>
      </tbody>
    </table>
    <div style="border-top:2px solid #01B8AA;margin-top:24px;padding-top:12px">
      <h4>BORROWER DECLARATION</h4>
      <p class="text-muted">I, ${d.borrowerName}, hereby acknowledge that I have received and understood the Key Fact Statement. I confirm that the APR, recovery mechanism, and grievance redressal mechanism have been explained to me prior to signing the Loan Agreement.</p>
      <div class="grid2" style="margin-top:20px">
        <div><div class="sig-block"><p class="font-bold">Borrower Signature</p><p class="text-muted">${d.borrowerName}</p></div></div>
        <div><div class="sig-block"><p class="font-bold">Date</p><p class="text-muted">${fmtDate(docDate, 'numeric')}</p></div></div>
      </div>
    </div>
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${sanctionLetter}${loanAgreement}${dailySchedule}${kfs}</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

// 1. Fetch all combined_loan_pack records with old file_path
const { data: allCombined, error: fetchErr } = await sb
  .from('loan_generated_documents')
  .select('id, loan_application_id, org_id, sanction_id, document_number, file_path, signed_document_path, customer_signed')
  .eq('document_type', 'combined_loan_pack');
if (fetchErr) throw fetchErr;

// 2. Filter: skip if file_path is already R2, skip if signed_document_path is valid R2
const toRegenerate = [];
for (const row of allCombined) {
  if (isR2(row.file_path)) {
    // Already has R2 file_path — skip
    continue;
  }
  if (isR2(row.signed_document_path)) {
    // Signed document is safe in R2 — skip unsigned regeneration per user instruction
    continue;
  }
  toRegenerate.push(row);
}

console.log(`Total combined_loan_pack records: ${allCombined.length}`);
console.log(`Skip (file_path already R2): ${allCombined.filter(r => isR2(r.file_path)).length}`);
console.log(`Skip (signed_document_path in R2): ${allCombined.filter(r => !isR2(r.file_path) && isR2(r.signed_document_path)).length}`);
console.log(`To regenerate: ${toRegenerate.length}\n`);

// 3. Fetch all supporting data in bulk
const appIds = [...new Set(toRegenerate.map(r => r.loan_application_id))];

// Fetch loan_applications
const { data: apps } = await sb.from('loan_applications').select('id, org_id, approved_amount, tenure_days, interest_rate').in('id', appIds);
const appMap = Object.fromEntries((apps || []).map(a => [a.id, a]));

// Fetch loan_sanctions
const { data: sanctions } = await sb.from('loan_sanctions').select('id, loan_application_id, processing_fee, gst_amount, net_disbursement_amount, validity_date, sanctioned_tenure_days').in('loan_application_id', appIds);
const sanctionMap = Object.fromEntries((sanctions || []).map(s => [s.loan_application_id, s]));

// Fetch loan_applicants (primary)
const { data: applicants } = await sb.from('loan_applicants').select('loan_application_id, first_name, last_name, mobile, pan_number, current_address, bank_name, bank_account_number, bank_ifsc_code').eq('applicant_type', 'primary').in('loan_application_id', appIds);
const applicantMap = Object.fromEntries((applicants || []).map(a => [a.loan_application_id, a]));

// Fetch loan_disbursements (first disbursement per loan for date)
const { data: disbursements } = await sb.from('loan_disbursements').select('loan_application_id, disbursement_date, bank_name, account_number, ifsc_code').in('loan_application_id', appIds).order('created_at', { ascending: true });
const disbMap = {};
for (const d of (disbursements || [])) {
  if (!disbMap[d.loan_application_id]) disbMap[d.loan_application_id] = d;
}

// Fetch individual doc numbers (sanction_letter, loan_agreement, daily_schedule, kfs)
const { data: allGenDocs } = await sb.from('loan_generated_documents').select('loan_application_id, document_type, document_number').in('loan_application_id', appIds).in('document_type', ['sanction_letter', 'loan_agreement', 'daily_schedule', 'kfs']);
const docNumMap = {};
for (const d of (allGenDocs || [])) {
  if (!docNumMap[d.loan_application_id]) docNumMap[d.loan_application_id] = {};
  docNumMap[d.loan_application_id][d.document_type] = d.document_number;
}

// 4. Launch Puppeteer
console.log('Launching Puppeteer...');
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

let ok = 0, failed = 0, skippedData = 0;

for (let i = 0; i < toRegenerate.length; i++) {
  const row = toRegenerate[i];
  const appId = row.loan_application_id;
  const app = appMap[appId];
  const sanction = sanctionMap[appId];
  const applicant = applicantMap[appId];
  const disb = disbMap[appId];

  if (!app || !sanction || !applicant) {
    console.error(`  [${i + 1}/${toRegenerate.length}] SKIP ${appId}: missing app/sanction/applicant data`);
    skippedData++;
    continue;
  }

  // Open a fresh page per document to avoid state issues
  const page = await browser.newPage();
  try {
    const loanAmount = sanction ? (sanction.sanctioned_amount || app.approved_amount) : app.approved_amount;
    const tenureDays = sanction?.sanctioned_tenure_days || app.tenure_days || 30;
    const interestRate = app.interest_rate || 1;
    const processingFee = sanction?.processing_fee || 0;
    const gstOnProcessingFee = sanction?.gst_amount || 0;
    const netDisbursal = sanction?.net_disbursement_amount || (loanAmount - processingFee - gstOnProcessingFee);
    const totalInterest = Math.round(loanAmount * (interestRate / 100) * tenureDays);
    const totalRepayment = loanAmount + totalInterest;

    const disbDate = disb?.disbursement_date ? new Date(disb.disbursement_date) : new Date(sanction?.created_at || app.created_at);
    const dueDate = addDays(disbDate, tenureDays);
    const validUntil = sanction?.validity_date ? new Date(sanction.validity_date) : addDays(disbDate, 30);
    const documentDate = disbDate;

    const borrowerName = [applicant.first_name, applicant.last_name].filter(Boolean).join(' ') || 'N/A';
    const addr = applicant.current_address;
    const borrowerAddress = (typeof addr === 'string' ? addr : addr?.line1 || addr?.full || JSON.stringify(addr)) || 'N/A';
    const borrowerPhone = applicant.mobile || 'N/A';

    const bankName = disb?.bank_name || applicant.bank_name || 'N/A';
    const accountNumber = disb?.account_number || applicant.bank_account_number || 'N/A';

    const docNums = docNumMap[appId] || {};
    const ts = Date.now().toString(36).toUpperCase();

    const d = {
      companyName: 'Paisaa Saarthi',
      borrowerName,
      borrowerAddress,
      borrowerPhone,
      borrowerPAN: applicant.pan_number,
      loanAmount,
      tenureDays,
      interestRate,
      totalInterest,
      totalRepayment,
      processingFee,
      gstOnProcessingFee,
      netDisbursal,
      dueDate,
      disbursementDate: disbDate,
      validUntil,
      documentDate,
      bankName,
      accountNumber,
      foreclosureRate: 4,
      bounceCharges: 500,
      penalInterest: 24,
      sanctionDocNumber: docNums.sanction_letter || `SANCTIONLETTER-${ts}`,
      agreementDocNumber: docNums.loan_agreement || `LOANAGREEMENT-${ts}`,
      scheduleDocNumber: docNums.daily_schedule || `DAILYSCHEDULE-${ts}`,
      kfsDocNumber: docNums.kfs || `KFS-${ts}`,
    };

    const html = generateHTML(d);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      printBackground: true,
    });

    const docNumber = row.document_number || `COMBINEDLOANPACK-${ts}`;
    const r2Key = `loan-docs/${row.org_id}/${appId}/combined_loan_pack/${docNumber}.pdf`;
    const r2Url = await uploadToR2(r2Key, pdfBuffer);

    const { error: updateErr } = await sb.from('loan_generated_documents')
      .update({ file_path: r2Url })
      .eq('id', row.id);
    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    ok++;
    console.log(`  [${i + 1}/${toRegenerate.length}] ✓ ${appId} → ${docNumber}`);
  } catch (err) {
    failed++;
    console.error(`  [${i + 1}/${toRegenerate.length}] FAIL ${appId}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\n✅ Done. Regenerated: ${ok}, Failed: ${failed}, Skipped (no data): ${skippedData}`);
