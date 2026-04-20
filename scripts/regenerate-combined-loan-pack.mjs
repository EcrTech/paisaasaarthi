/**
 * Regenerates the Combined Loan Pack PDF for LA-202603-10793
 * Uploads to R2 and updates loan_generated_documents.file_path
 */

import puppeteer from 'puppeteer';
import { AwsClient } from 'aws4fetch';
import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'fs/promises';

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

// ── Loan Data ─────────────────────────────────────────────────────────────────
const DOC_ID = '90d700ba-9fd0-468a-af9a-996960bc3c5b'; // combined_loan_pack record id
const ORG_ID = 'a31a6056-72c8-458a-9bd8-1c43e8360095';
const APP_ID = 'abc03b42-6c06-4bb3-b151-00c0078ae025';

const data = {
  companyName: 'Paisaa Saarthi',
  borrowerName: 'Golla Raghupathi',
  borrowerAddress: 'S/O C KRISHNAIAH, FLAT NO 301, 4 SHAKTHI NAGAR, DELHI PUBLIC SCHOOL, MAHENDRAHILLS, Maredpalle, PO: Mehrunagar, DIST: Hyderabad, Telangana - 500026',
  borrowerPhone: '8125239644',
  borrowerPAN: 'AVBPR0545B',
  loanAmount: 20000,
  tenureDays: 22,
  interestRate: 1,
  totalInterest: 4400,
  totalRepayment: 24400,
  processingFee: 2000,
  gstOnProcessingFee: 360,
  netDisbursal: 17640,
  dueDate: new Date('2026-04-18'),
  disbursementDate: new Date('2026-03-27'),
  validUntil: new Date('2026-04-26'),
  documentDate: new Date('2026-03-27'),
  bankName: 'Canara Bank',
  accountNumber: '110210397968',
  ifscCode: 'CNRB0013046',
  foreclosureRate: 4,
  bounceCharges: 500,
  penalInterest: 24,
  sanctionDocNumber: 'SANCTIONLETTER-MN8UKHJ6',
  agreementDocNumber: 'LOANAGREEMENT-MN8UKHJ6',
  scheduleDocNumber: 'DAILYSCHEDULE-MN8UKHJ6',
  kfsDocNumber: 'KFS-MN8UKHJ6',
  combinedDocNumber: 'COMBINEDLOANPACK-MN8UKMAW',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = n => `Rs.${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`;

function fmtDate(d, style = 'long') {
  const opts = style === 'long'
    ? { day: '2-digit', month: 'long', year: 'numeric' }
    : style === 'short'
    ? { day: '2-digit', month: 'short', year: 'numeric' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return d.toLocaleDateString('en-IN', opts);
}

function addDays(d, n) {
  const r = new Date(d);
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

// ── Document Header ──────────────────────────────────────────────────────────
function docHeader(title, docNumber, docDate) {
  return `
  <div class="header">
    <div class="header-flex">
      <div>
        <div class="company-name">${data.companyName}</div>
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

// ── 1. Sanction Letter ────────────────────────────────────────────────────────
function sanctionLetter() {
  const terms = [
    'The loan is granted subject to the accuracy of information and documents provided.',
    'The interest shall accrue from the date of disbursement.',
    'Repayment must be made in full on or before the due date.',
    'Late payment will attract penal interest as per the loan agreement.',
    'The sanction is non-transferable and cannot be used as collateral.',
    'The lender reserves the right to recall the loan in case of any misrepresentation.',
    'This sanction is subject to KYC norms and RBI guidelines.',
  ];
  return `
  <div class="page">
    ${docHeader('LOAN SANCTION LETTER', data.sanctionDocNumber, data.documentDate)}
    <p><strong>To,</strong></p>
    <p class="font-bold" style="font-size:13px">${data.borrowerName}</p>
    <p class="text-muted">${data.borrowerAddress}</p>
    <br>
    <p><strong>Subject:</strong> Sanction of Personal Loan – Reference No. ${data.sanctionDocNumber}</p>
    <p>Dear ${data.borrowerName.split(' ')[0]},</p>
    <p>We are pleased to inform you that your application for a Personal Loan has been <strong class="text-primary">APPROVED</strong>. Based on our assessment and subject to the terms and conditions mentioned herein, we are sanctioning a loan as per the following details:</p>

    <table>
      <tbody>
        <tr><td class="bg-muted font-bold" width="50%">Loan Amount Sanctioned</td><td><strong style="font-size:13px">${fmt(data.loanAmount)}</strong><br><small class="text-muted">(Rupees ${numberToWords(data.loanAmount)} Only)</small></td></tr>
        <tr><td class="bg-muted">Rate of Interest</td><td>${data.interestRate}% per day (Flat)</td></tr>
        <tr><td class="bg-muted">Loan Tenure</td><td>${data.tenureDays} Days</td></tr>
        <tr><td class="bg-muted">Total Interest</td><td>${fmt(data.totalInterest)}</td></tr>
        <tr><td class="bg-muted font-bold">Total Repayment Amount</td><td><strong>${fmt(data.totalRepayment)}</strong></td></tr>
        <tr><td class="bg-muted">Due Date</td><td><strong>${fmtDate(data.dueDate, 'long')}</strong></td></tr>
        <tr><td class="bg-muted">Processing Fee</td><td>${fmt(data.processingFee)}</td></tr>
        <tr><td class="bg-muted">GST on Processing Fee</td><td>${fmt(data.gstOnProcessingFee)}</td></tr>
        <tr><td class="bg-muted font-bold text-primary">Net Disbursal Amount</td><td><strong class="text-primary">${fmt(data.netDisbursal)}</strong></td></tr>
        <tr><td class="bg-muted">Sanction Validity</td><td style="color:red">Valid until ${fmtDate(data.validUntil, 'long')}</td></tr>
      </tbody>
    </table>

    <h3>TERMS AND CONDITIONS</h3>
    <ol>${terms.map(t => `<li>${t}</li>`).join('')}</ol>

    <div class="warn">
      <p style="color:#c00">This sanction is valid until ${fmtDate(data.validUntil, 'long')}. Post this date, you will need to re-apply for the loan. Please complete the documentation and disbursement formalities before the expiry date.</p>
    </div>

    <h3>NEXT STEPS</h3>
    <ol>
      <li>Accept this sanction letter by signing below</li>
      <li>Complete KYC documentation if not already done</li>
      <li>Set up NACH mandate for repayment on the due date</li>
      <li>Provide bank account details for disbursement</li>
      <li>Sign the Loan Agreement and related documents</li>
    </ol>

    <p>We thank you for choosing ${data.companyName} and look forward to a long-term relationship.</p>
    <p>Warm regards,</p>

    <div class="grid2" style="margin-top:20px">
      <div>
        <div class="sig-block">
          <p class="font-bold">For ${data.companyName}</p>
          <p class="text-muted">Authorized Signatory</p>
        </div>
      </div>
    </div>

    <div style="border-top:2px solid #01B8AA; margin-top:30px; padding-top:12px">
      <h4>BORROWER ACCEPTANCE</h4>
      <p class="text-muted">I, ${data.borrowerName}, hereby accept the above sanction and agree to abide by all the terms and conditions mentioned herein.</p>
      <div class="grid2" style="margin-top:20px">
        <div><div class="sig-block"><p class="font-bold">Borrower Signature</p><p class="text-muted">${data.borrowerName}</p></div></div>
        <div><div class="sig-block"><p class="font-bold">Date</p></div></div>
      </div>
    </div>
  </div>`;
}

// ── 2. Loan Agreement ─────────────────────────────────────────────────────────
function loanAgreement() {
  return `
  <div class="page page-break">
    ${docHeader('LOAN AGREEMENT', data.agreementDocNumber, data.documentDate)}

    <div style="margin-bottom:10px;font-size:11px">
      <p>This loan agreement "Agreement" is entered by electronic means on the day mentioned in the Schedule of Loan Details and Terms of the agreement.</p>
      <h4>BY AND BETWEEN:</h4>
      <p>SKYRISE CREDIT AND MARKETING LIMITED, a duly registered Non-Banking Financial Company registered with the Reserve Bank of India and incorporated in India under Companies Act 1956 with Corporate Identification Number (CIN): U74899DL1993PLC055475 with Corporate office:- Office No 110, H-161, Sector -63, Noida, UP-201301 (hereinafter referred to as the "Lender" of the FIRST PART).</p>
      <p class="text-center font-bold">and</p>
      <p>${data.borrowerName} an Indian resident with Permanent Account Number (PAN): ${data.borrowerPAN || 'N/A'} Address: ${data.borrowerAddress} Phone Number: ${data.borrowerPhone} (hereinafter referred to as the "Borrower" of the SECOND PART).</p>
    </div>

    <h3>Witnesseth</h3>
    <p>Whereas, paisaasaarthi.com is an online loan origination platform of PAISAA SAARTHI FINTECH PVT LTD that markets personal loan products to borrowers.</p>
    <p>Whereas, the Lender is a Non-Banking Financial Company, engaged in the business to provide loans to individual and business customers in India;</p>
    <p>Whereas the Borrower has registered on the website and applied for the loan by furnishing personal and income details and submitting required KYC documents.</p>

    <h3>1. Commencement</h3>
    <p>This agreement shall come into effect from the date of this agreement as recorded in the Schedule of Loan Details and Terms appended to this agreement.</p>

    <h3>Borrower Acknowledgements and Confirmation</h3>
    <ol>
      <li>I have personally applied for the Loan on the website after confirming acceptance of the terms and conditions of Use and Privacy Policies listed on the App.</li>
      <li>I acknowledge that my Name, details of PAN, Aadhaar Card are obtained by the Service provider and Lender from the materials I have submitted.</li>
      <li>I understand the terms of the loan to be provided to me by the Lender are approved as per the internal policies and credit underwriting process.</li>
      <li>I understand all the terms listed above and hereby make a drawdown request of the Loan from the Lender.</li>
    </ol>

    <h3>Borrower Undertaking</h3>
    <p>I represent that the information and details provided by me for the registration and loan application are true, correct and that I have not withheld any information.</p>
    <p>I have read and understood the fees and charges applicable to the Loan that I may avail.</p>
    <p>I confirm that no insolvency proceedings or suits for recovery of outstanding dues have been initiated against me.</p>
    <p>I hereby authorize Lender to exchange or share information relating to this Application Form to its associate companies or any third party, as may be required for processing this loan application.</p>
    <p>That Lender shall have the right to make disclosure of any information relating to me to CIBIL or any other Credit Bureau and/or any other governmental/regulatory/statutory or private agency/entity, RBI, KYC.</p>
    <p>That the funds shall be used for the Purpose specified in the SCHEDULE OF LOAN DETAILS AND TERMS and will not be used for speculative or antisocial purposes.</p>

    <h3>Representations and Warranties of the Parties</h3>
    <ul>
      <li>He has full power and authority to enter into, deliver and perform the terms and provisions of this agreement.</li>
      <li>His obligation under this agreement are legal and valid binding on him and enforceable against him.</li>
      <li>The parties to the agreement warrant and represent to have the legal competence to execute and perform this agreement.</li>
    </ul>

    <h3>Disbursement of the Loan</h3>
    <p>The Lender will disburse the loan by online means into the bank account of the borrower as specified by the borrower in its loan application filled on the App after the acceptance of this agreement.</p>

    <h3>Repayment of the Loan</h3>
    <p>Borrower will repay the required repayment amount in full as mentioned in the Schedule of Loan Details and Terms, on or before the due date without any failure.</p>
    <p>Borrower undertakes to maintain sufficient balance in the account of the drawee bank for payment of the eMandate/ENACH issued by him on the day when the payment becomes due.</p>

    <h3>Events of Defaults</h3>
    <ul>
      <li>The borrower failing to repay the loan or any fee, charges, or costs in the manner herein contained on the date on which it is due; or</li>
      <li>In case of death of the borrower or the borrower becomes insolvent or bankrupt; or</li>
      <li>Any of the eMandate/ENACH/Post Dated Cheques delivered by the borrower is not realized for any reason whatsoever on presentation; or</li>
      <li>On the borrower committing breach of any of the terms, covenants and conditions herein contained.</li>
    </ul>

    <h3>Consequence of default</h3>
    <p>The Service Provider on behalf of the Lender will take such necessary steps as permitted by law against the borrower to realize the amounts due along with the interest at the decided rate and other fees/costs as agreed in this agreement.</p>

    <h3>Governing law, Dispute Resolution and Jurisdiction</h3>
    <p>Any dispute shall be finally settled by the court of law having jurisdiction to grant the same. Jurisdiction – New Delhi, Delhi.</p>

    <h3>SCHEDULE OF LOAN DETAILS AND TERMS</h3>
    <table>
      <tbody>
        <tr><td class="bg-muted" width="10%">1</td><td class="bg-muted" width="40%">Loan ID Number</td><td class="font-bold">${data.agreementDocNumber}</td></tr>
        <tr><td>2</td><td>Agreement Date</td><td>${fmtDate(data.documentDate, 'long')}</td></tr>
        <tr><td>3</td><td>Borrower</td><td>${data.borrowerName}</td></tr>
        <tr><td>4</td><td>Lender</td><td>SKYRISE CREDIT AND MARKETING LIMITED</td></tr>
        <tr><td>7</td><td class="font-bold">Principal Loan Amount</td><td class="font-bold">${fmt(data.loanAmount)}</td></tr>
        <tr><td>8</td><td>Tenure (Days)</td><td>${data.tenureDays} Days</td></tr>
        <tr><td>9</td><td>Rate of Interest</td><td>${data.interestRate.toFixed(2)}% Per Day</td></tr>
        <tr><td>10</td><td>Processing Fees</td><td>${fmt(data.processingFee)}</td></tr>
        <tr><td>12</td><td>GST</td><td>${fmt(data.gstOnProcessingFee)}</td></tr>
        <tr><td>13</td><td class="font-bold text-primary">Amount to be Disbursed</td><td class="font-bold text-primary">${fmt(data.netDisbursal)}</td></tr>
        <tr><td>14</td><td>Due Date</td><td class="font-bold">${fmtDate(data.dueDate, 'long')}</td></tr>
        <tr><td>15</td><td>Repayment Amount</td><td class="font-bold">${fmt(data.totalRepayment)}</td></tr>
      </tbody>
    </table>

    <p>IN WHEREOF the Parties have executed this Agreement as of (${fmtDate(data.documentDate, 'numeric')}) by means of adding their acceptance on the website.</p>

    <div class="grid2" style="margin-top:20px">
      <div>
        <p class="font-bold">For SKYRISE CREDIT AND MARKETING LIMITED.</p>
        <div class="sig-block"><p class="text-muted font-size-10">Authorized Signatory</p></div>
      </div>
      <div>
        <p class="font-bold">Signature of the Applicant</p>
        <div class="sig-block">
          <p>Name: ______${data.borrowerName}__________</p>
          <p class="text-muted" style="font-size:10px">Specimen Signature/ESIGN Impression</p>
        </div>
      </div>
    </div>
  </div>`;
}

// ── 3. Daily Repayment Schedule ───────────────────────────────────────────────
function dailySchedule() {
  const dailyInterest = data.loanAmount * (data.interestRate / 100);
  const maturityDate = addDays(data.disbursementDate, data.tenureDays);

  let rows = '';
  for (let i = 1; i <= data.tenureDays; i++) {
    const date = addDays(data.disbursementDate, i);
    const interestAccrued = Math.round(dailyInterest * i);
    const totalDue = data.loanAmount + interestAccrued;
    const cls = i === data.tenureDays ? 'due-row' : i % 2 === 0 ? '' : 'odd-row';
    rows += `<tr class="${cls}">
      <td>${i}</td>
      <td>${fmtDate(date, 'short')}</td>
      <td class="text-right">${fmt(Math.round(dailyInterest))}</td>
      <td class="text-right">${fmt(interestAccrued)}</td>
      <td class="text-right">${fmt(totalDue)}</td>
    </tr>`;
  }

  return `
  <div class="page page-break">
    ${docHeader('DAILY REPAYMENT SCHEDULE', data.scheduleDocNumber, data.documentDate)}

    <div class="notice">
      <p>This document shows the total amount payable if the loan is repaid on any given day. Interest accrues daily at ${data.interestRate}% of the principal. The full repayment is due on <strong>${fmtDate(maturityDate, 'long')}</strong>.</p>
    </div>

    <h3>1. BORROWER INFORMATION</h3>
    <div class="grid2">
      <div><span class="text-muted">Borrower Name:</span> <strong>${data.borrowerName}</strong></div>
      <div><span class="text-muted">Phone:</span> <strong>${data.borrowerPhone}</strong></div>
      <div class="grid2-span"><span class="text-muted">Address:</span> ${data.borrowerAddress}</div>
    </div>

    <h3>2. LOAN SUMMARY</h3>
    <table>
      <tbody>
        <tr><td class="bg-muted" width="50%">Loan Principal Amount</td><td class="font-bold">${fmt(data.loanAmount)}</td></tr>
        <tr><td class="bg-muted">Daily Interest Rate</td><td>${data.interestRate}% per day (Flat)</td></tr>
        <tr><td class="bg-muted">Daily Interest Amount</td><td>${fmt(Math.round(dailyInterest))}</td></tr>
        <tr><td class="bg-muted">Loan Tenure</td><td>${data.tenureDays} Days</td></tr>
        <tr><td class="bg-muted">Total Interest Payable</td><td>${fmt(Math.round(dailyInterest * data.tenureDays))}</td></tr>
        <tr><td class="bg-muted font-bold">Total Amount Repayable</td><td class="font-bold">${fmt(data.loanAmount + Math.round(dailyInterest * data.tenureDays))}</td></tr>
        <tr><td class="bg-muted">Disbursement Date</td><td>${fmtDate(data.disbursementDate, 'long')}</td></tr>
        <tr><td class="bg-muted">Maturity / Due Date</td><td class="font-bold">${fmtDate(maturityDate, 'long')}</td></tr>
      </tbody>
    </table>

    <h3>3. REPAYMENT COLLECTION DETAILS</h3>
    <div style="background:#f5f5f5;border-radius:4px;padding:8px;font-size:11px">
      <p>Repayment will be collected from:</p>
      <p><strong>Bank:</strong> ${data.bankName}</p>
      <p><strong>Account Number:</strong> ${data.accountNumber}</p>
    </div>

    <h3>4. DAILY INTEREST ACCRUAL SCHEDULE</h3>
    <p class="text-muted">The table below shows the total amount due if the loan is settled on any given day.</p>
    <table>
      <thead>
        <tr><th>Day</th><th>Date</th><th class="text-right">Daily Interest</th><th class="text-right">Interest Accrued</th><th class="text-right">Total Amount Due</th></tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:#e6f7f5;font-weight:bold;border-top:2px solid #01B8AA">
          <td colspan="2">TOTAL ON MATURITY</td>
          <td class="text-right">${fmt(Math.round(dailyInterest))}/day</td>
          <td class="text-right">${fmt(Math.round(dailyInterest * data.tenureDays))}</td>
          <td class="text-right">${fmt(data.loanAmount + Math.round(dailyInterest * data.tenureDays))}</td>
        </tr>
      </tbody>
    </table>

    <h3>5. IMPORTANT INFORMATION</h3>
    <ul>
      <li>Interest accrues daily at ${data.interestRate}% of the principal amount (${fmt(Math.round(dailyInterest))} per day).</li>
      <li>The total repayment of ${fmt(data.totalRepayment)} is due on ${fmtDate(maturityDate, 'long')}.</li>
      <li>Early repayment is permitted subject to foreclosure charges as per the loan agreement.</li>
      <li>Late payment beyond the due date will attract penal interest and may affect your credit score.</li>
      <li>Ensure sufficient balance in your linked bank account for auto-debit on the due date.</li>
    </ul>

    <div style="border-top:2px solid #01B8AA;margin-top:24px;padding-top:12px">
      <h4>BORROWER ACKNOWLEDGMENT</h4>
      <p class="text-muted">I hereby acknowledge that I have received and understood the daily interest accrual schedule. I agree to repay the total amount due on the maturity date as per the schedule mentioned above.</p>
      <div class="grid2" style="margin-top:20px">
        <div><div class="sig-block"><p class="font-bold">Borrower Signature</p><p class="text-muted">${data.borrowerName}</p></div></div>
        <div><div class="sig-block"><p class="font-bold">Date</p><p class="text-muted">${fmtDate(data.documentDate, 'numeric')}</p></div></div>
      </div>
    </div>
  </div>`;
}

// ── 4. Key Fact Statement ─────────────────────────────────────────────────────
function keyFactStatement() {
  const totalCost = data.totalInterest + data.processingFee + data.gstOnProcessingFee;
  const apr = ((totalCost / data.netDisbursal) / (data.tenureDays / 365)) * 100;

  return `
  <div class="page page-break">
    ${docHeader('KEY FACT STATEMENT (KFS)', data.kfsDocNumber, data.documentDate)}

    <p class="text-muted">As per RBI Circular on Digital Lending dated 02.09.2022, the Key Fact Statement (KFS) is provided to the Borrower prior to execution of the Loan Agreement. This document contains the key facts about the loan in a standardised format.</p>

    <h3>ANNEX A – PART 1: INTEREST RATE AND FEES/CHARGES</h3>
    <table>
      <tbody>
        <tr><td class="bg-muted font-bold" width="50%">Loan Sanctioned Amount</td><td class="font-bold">${fmt(data.loanAmount)}</td></tr>
        <tr><td class="bg-muted">Loan Tenure</td><td>${data.tenureDays} Days</td></tr>
        <tr><td class="bg-muted">Number of Instalments</td><td>1 (Bullet Repayment)</td></tr>
        <tr><td class="bg-muted font-bold">Instalment Amount</td><td class="font-bold">${fmt(data.totalRepayment)}</td></tr>
        <tr><td class="bg-muted">Rate of Interest</td><td>${data.interestRate}% Per Day (Flat)</td></tr>
        <tr><td class="bg-muted">Interest Rate Type</td><td>Fixed</td></tr>
        <tr><td class="bg-muted">Total Interest Charged</td><td>${fmt(data.totalInterest)}</td></tr>
        <tr><td class="bg-muted">Processing Fee</td><td>${fmt(data.processingFee)}</td></tr>
        <tr><td class="bg-muted">GST on Processing Fee</td><td>${fmt(data.gstOnProcessingFee)}</td></tr>
        <tr><td class="bg-muted font-bold text-primary">Net Disbursed Amount</td><td class="font-bold text-primary">${fmt(data.netDisbursal)}</td></tr>
        <tr><td class="bg-muted font-bold">Annual Percentage Rate (APR)</td><td class="font-bold">${apr.toFixed(2)}%</td></tr>
        <tr><td class="bg-muted">Penal/Contingent Charges</td><td>Penal Interest @ ${data.penalInterest}% p.a. on overdue amount; Bounce Charges ${fmt(data.bounceCharges)} per instance + GST</td></tr>
        <tr><td class="bg-muted">Foreclosure/Prepayment Charges</td><td>${data.foreclosureRate}% of outstanding principal + applicable GST</td></tr>
      </tbody>
    </table>

    <h3>ANNEX A – PART 2: QUALITATIVE INFORMATION</h3>
    <table>
      <tbody>
        <tr><td class="bg-muted" width="50%">Recovery Agents Engaged</td><td>As per RBI guidelines, recovery agents (if engaged) will carry proper authorization and follow the Fair Practices Code.</td></tr>
        <tr><td class="bg-muted">Grievance Redressal Officer</td><td>As per company website</td></tr>
        <tr><td class="bg-muted">Nodal Officer / Escalation</td><td>If the complaint is not resolved within 30 days, the Borrower may escalate to the RBI's Integrated Ombudsman Scheme (https://cms.rbi.org.in).</td></tr>
        <tr><td class="bg-muted">Securitisation / Assignment</td><td>The Lender reserves the right to securitize or assign the loan. The Borrower will be duly notified in such an event.</td></tr>
        <tr><td class="bg-muted">Lending Service Provider (LSP)</td><td>Loan facilitated through the Lender's digital lending platform.</td></tr>
        <tr><td class="bg-muted">Cooling-Off / Look-Up Period</td><td>The Borrower may exit the loan within 3 days of disbursement by repaying the principal and proportionate interest, without any penalty.</td></tr>
      </tbody>
    </table>

    <h3>ANNEX B: APR COMPUTATION</h3>
    <table>
      <tbody>
        <tr><td class="bg-muted" width="50%">Sanctioned Loan Amount</td><td>${fmt(data.loanAmount)}</td></tr>
        <tr><td class="bg-muted">Loan Term</td><td>${data.tenureDays} Days</td></tr>
        <tr><td class="bg-muted">Instalment Details</td><td>1 Bullet Payment of ${fmt(data.totalRepayment)}</td></tr>
        <tr><td class="bg-muted">Rate of Interest</td><td>${data.interestRate}% Per Day (Flat, Fixed)</td></tr>
        <tr><td class="bg-muted">Total Interest Charged</td><td>${fmt(data.totalInterest)}</td></tr>
        <tr><td class="bg-muted">Processing Fee + GST</td><td>${fmt(data.processingFee + data.gstOnProcessingFee)}</td></tr>
        <tr><td class="bg-muted">Net Amount Disbursed</td><td>${fmt(data.netDisbursal)}</td></tr>
        <tr><td class="bg-muted font-bold">Total Amount to be Paid</td><td class="font-bold">${fmt(data.totalRepayment)}</td></tr>
        <tr><td class="bg-muted font-bold">Annual Percentage Rate (APR)</td><td class="font-bold">${apr.toFixed(2)}%</td></tr>
      </tbody>
    </table>

    <h3>ANNEX C: REPAYMENT SCHEDULE</h3>
    <table>
      <thead>
        <tr><th>Instalment No.</th><th>Due Date</th><th class="text-right">Outstanding Principal</th><th class="text-right">Principal</th><th class="text-right">Interest</th><th class="text-right">Instalment Amount</th></tr>
      </thead>
      <tbody>
        <tr class="font-bold odd-row">
          <td>1</td>
          <td>${fmtDate(data.dueDate, 'short')}</td>
          <td class="text-right">${fmt(data.loanAmount)}</td>
          <td class="text-right">${fmt(data.loanAmount)}</td>
          <td class="text-right">${fmt(data.totalInterest)}</td>
          <td class="text-right">${fmt(data.totalRepayment)}</td>
        </tr>
        <tr style="background:#e6f7f5;font-weight:bold;border-top:1px solid #01B8AA">
          <td colspan="3">TOTAL</td>
          <td class="text-right">${fmt(data.loanAmount)}</td>
          <td class="text-right">${fmt(data.totalInterest)}</td>
          <td class="text-right">${fmt(data.totalRepayment)}</td>
        </tr>
      </tbody>
    </table>

    <div style="border-top:2px solid #01B8AA;margin-top:24px;padding-top:12px">
      <h4>BORROWER DECLARATION</h4>
      <p class="text-muted">I, ${data.borrowerName}, hereby acknowledge that I have received and understood the Key Fact Statement. I confirm that the Annual Percentage Rate (APR), recovery mechanism, and grievance redressal mechanism have been explained to me prior to signing the Loan Agreement.</p>
      <div class="grid2" style="margin-top:20px">
        <div><div class="sig-block"><p class="font-bold">Borrower Signature</p><p class="text-muted">${data.borrowerName}</p></div></div>
        <div><div class="sig-block"><p class="font-bold">Date</p><p class="text-muted">${fmtDate(data.documentDate, 'numeric')}</p></div></div>
      </div>
    </div>
  </div>`;
}

// ── Generate HTML ─────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Combined Loan Pack - ${data.combinedDocNumber}</title>
  <style>${css}</style>
</head>
<body>
  ${sanctionLetter()}
  ${loanAgreement()}
  ${dailySchedule()}
  ${keyFactStatement()}
</body>
</html>`;

// ── Generate PDF with Puppeteer ───────────────────────────────────────────────
console.log('Launching Puppeteer...');
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });

const pdfBuffer = await page.pdf({
  format: 'A4',
  margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  printBackground: true,
});
await browser.close();
console.log(`PDF generated: ${pdfBuffer.length} bytes`);

// ── Save locally to Downloads ─────────────────────────────────────────────────
const localPath = `C:/Users/admin/Downloads/LA-202603-10793/Combined-Loan-Pack-${data.combinedDocNumber}.pdf`;
await writeFile(localPath, pdfBuffer);
console.log(`Saved locally: ${localPath}`);

// ── Upload to R2 ──────────────────────────────────────────────────────────────
const r2Key = `loan-docs/${ORG_ID}/${APP_ID}/combined_loan_pack/${data.combinedDocNumber}.pdf`;
console.log(`Uploading to R2: ${r2Key}`);

const uploadRes = await r2.fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${r2Key}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(pdfBuffer.length) },
  body: pdfBuffer,
});
if (!uploadRes.ok) throw new Error(`R2 upload failed: ${uploadRes.status} ${await uploadRes.text()}`);

const r2Url = `${R2_PUBLIC_BASE}/${r2Key}`;
console.log(`Uploaded to R2: ${r2Url}`);

// ── Update DB ─────────────────────────────────────────────────────────────────
const { error } = await sb.from('loan_generated_documents').update({ file_path: r2Url }).eq('id', DOC_ID);
if (error) throw new Error(`DB update failed: ${error.message}`);
console.log(`DB updated: loan_generated_documents.file_path = ${r2Url}`);
console.log('Done!');
