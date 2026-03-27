import html2pdf from "html2pdf.js";

interface CreditReportData {
  reportOrderNo: string;
  reportDate: string;
  creditScore: number;
  scoreType: string;
  scoreVersion?: string;
  hitCode: string;
  hitDescription: string;
  summary: {
    totalAccounts: number;
    activeAccounts: number;
    closedAccounts: number;
    writeOffAccounts: number;
    totalOutstanding: number;
    totalPastDue: number;
    totalSanctioned: number;
    oldestAccountDate?: string;
    recentAccountDate?: string;
    totalCreditLimit?: number;
    totalMonthlyPayment?: number;
  };
  accounts: Array<{
    institution: string;
    accountType: string;
    ownershipType: string;
    accountNumber: string;
    status: string;
    sanctionAmount: number;
    currentBalance: number;
    pastDueAmount: number;
    emiAmount: number;
    dateOpened: string;
    dateClosed?: string;
    dateReported?: string;
    paymentHistory: Array<{
      month: number;
      status: string;
      label: string;
      severity: "current" | "dpd" | "severe" | "writeoff";
    }>;
  }>;
  enquiries: {
    total30Days: number;
    total90Days: number;
    totalAll: number;
    list: Array<{
      date: string;
      institution: string;
      purpose: string;
      amount: number;
    }>;
  };
  personalInfo: {
    name: string;
    dob: string;
    pan: string;
    gender: string;
    addresses?: string[];
    phones?: string[];
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

function getScoreLabel(score: number): string {
  if (score >= 750) return "Excellent";
  if (score >= 700) return "Good";
  if (score >= 650) return "Fair";
  if (score >= 600) return "Below Average";
  return "Poor";
}

function getScoreColor(score: number): string {
  if (score >= 750) return "#16a34a";
  if (score >= 600) return "#ca8a04";
  return "#dc2626";
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "current": return "#22c55e";
    case "dpd": return "#eab308";
    case "severe": return "#f97316";
    case "writeoff": return "#dc2626";
    default: return "#d1d5db";
  }
}

function getStatusBgColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "current" || s === "active") return "#dcfce7";
  if (s === "closed") return "#f3f4f6";
  if (s.includes("past due") || s.includes("dpd")) return "#fef9c3";
  if (s.includes("write") || s.includes("loss")) return "#fee2e2";
  if (s.includes("settled")) return "#e0e7ff";
  return "#f3f4f6";
}

function buildHtml(data: CreditReportData): string {
  // Normalise: handle snake_case keys from DB storage
  const pi = data.personalInfo || (data as any).personal_info || { name: "", dob: "", pan: "", gender: "" };
  const sum = data.summary || { totalAccounts: 0, activeAccounts: 0, closedAccounts: 0, writeOffAccounts: 0, totalOutstanding: 0, totalPastDue: 0, totalSanctioned: 0 };
  const accts = data.accounts || [];
  const enq = data.enquiries || { total30Days: 0, total90Days: 0, totalAll: 0, list: [] };

  const scoreColor = getScoreColor(data.creditScore);
  const scoreLabel = getScoreLabel(data.creditScore);

  // Personal Info + Score section
  const personalInfoHtml = `
    <div style="display: flex; gap: 20px; margin-bottom: 24px;">
      <div style="flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Applicant Details</h3>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><td style="color: #6b7280; padding: 3px 0; width: 120px;">Name</td><td style="font-weight: 600;">${pi.name || "N/A"}</td></tr>
          <tr><td style="color: #6b7280; padding: 3px 0;">PAN</td><td style="font-weight: 600; font-family: monospace;">${pi.pan || "N/A"}</td></tr>
          <tr><td style="color: #6b7280; padding: 3px 0;">Date of Birth</td><td style="font-weight: 600;">${formatDate(pi.dob)}</td></tr>
          <tr><td style="color: #6b7280; padding: 3px 0;">Gender</td><td style="font-weight: 600;">${pi.gender || "N/A"}</td></tr>
          <tr><td style="color: #6b7280; padding: 3px 0;">Report Date</td><td style="font-weight: 600;">${formatDate(data.reportDate)}</td></tr>
          <tr><td style="color: #6b7280; padding: 3px 0;">Report No</td><td style="font-weight: 600; font-family: monospace; font-size: 11px;">${data.reportOrderNo || "N/A"}</td></tr>
        </table>
      </div>
      <div style="width: 200px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Credit Score</h3>
        <div style="font-size: 48px; font-weight: 700; color: ${scoreColor}; margin: 16px 0 4px 0;">${data.creditScore}</div>
        <div style="display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: ${scoreColor}; border: 1px solid ${scoreColor};">${scoreLabel}</div>
        <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">out of 900 &middot; ${data.scoreType}${data.scoreVersion ? " " + data.scoreVersion : ""}</div>
      </div>
    </div>
  `;

  // Addresses & Phones
  let contactHtml = "";
  if ((pi.addresses && pi.addresses.length > 0) ||
      (pi.phones && pi.phones.length > 0)) {
    contactHtml = `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Contact Information</h3>
        ${pi.addresses ? pi.addresses.map((addr, i) => `
          <div style="font-size: 12px; margin-bottom: 6px;">
            <span style="color: #6b7280;">Address ${i + 1}:</span>
            <span style="margin-left: 8px;">${addr}</span>
          </div>
        `).join("") : ""}
        ${pi.phones ? `
          <div style="font-size: 12px; margin-top: 8px;">
            <span style="color: #6b7280;">Phone/Email:</span>
            <span style="margin-left: 8px;">${pi.phones.join(", ")}</span>
          </div>
        ` : ""}
      </div>
    `;
  }

  // Account Summary
  const summaryHtml = `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Account Summary</h3>
      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div style="flex: 1; text-align: center; padding: 12px; background: #f9fafb; border-radius: 6px;">
          <div style="font-size: 24px; font-weight: 700;">${sum.totalAccounts}</div>
          <div style="font-size: 11px; color: #6b7280;">Total Accounts</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 12px; background: #f0fdf4; border-radius: 6px;">
          <div style="font-size: 24px; font-weight: 700; color: #16a34a;">${sum.activeAccounts}</div>
          <div style="font-size: 11px; color: #6b7280;">Active</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 12px; background: #f9fafb; border-radius: 6px;">
          <div style="font-size: 24px; font-weight: 700;">${sum.closedAccounts}</div>
          <div style="font-size: 11px; color: #6b7280;">Closed</div>
        </div>
        ${sum.writeOffAccounts > 0 ? `
          <div style="flex: 1; text-align: center; padding: 12px; background: #fef2f2; border-radius: 6px;">
            <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${sum.writeOffAccounts}</div>
            <div style="font-size: 11px; color: #6b7280;">Write-offs</div>
          </div>
        ` : ""}
      </div>
      <div style="display: flex; gap: 12px;">
        <div style="flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px;">
          <div style="font-size: 11px; color: #6b7280;">Total Outstanding</div>
          <div style="font-size: 16px; font-weight: 700;">${formatCurrency(sum.totalOutstanding)}</div>
        </div>
        <div style="flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px;">
          <div style="font-size: 11px; color: #6b7280;">Total Past Due</div>
          <div style="font-size: 16px; font-weight: 700; ${sum.totalPastDue > 0 ? "color: #dc2626;" : ""}">${formatCurrency(sum.totalPastDue)}</div>
        </div>
        <div style="flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px;">
          <div style="font-size: 11px; color: #6b7280;">Total Sanctioned</div>
          <div style="font-size: 16px; font-weight: 700;">${formatCurrency(sum.totalSanctioned)}</div>
        </div>
      </div>
    </div>
  `;

  // Account Details
  const accountsHtml = accts.map((acct, idx) => {
    const historyBars = acct.paymentHistory.slice(0, 24).map(h =>
      `<div style="width: 10px; height: 14px; border-radius: 2px; background: ${getSeverityColor(h.severity)};" title="${h.label}"></div>`
    ).join("");

    return `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; page-break-inside: avoid;">
        <div style="padding: 12px 16px; background: ${getStatusBgColor(acct.status)}; border-radius: 8px 8px 0 0; border-bottom: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600; font-size: 13px;">${acct.institution}</div>
              <div style="font-size: 11px; color: #6b7280;">${acct.accountType} &middot; ${acct.ownershipType}</div>
            </div>
            <div style="padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; background: white; border: 1px solid #d1d5db;">${acct.status}</div>
          </div>
        </div>
        <div style="padding: 12px 16px;">
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr>
              <td style="color: #6b7280; padding: 3px 0; width: 25%;">Account No</td>
              <td style="font-weight: 500; width: 25%; font-family: monospace; font-size: 11px;">${acct.accountNumber}</td>
              <td style="color: #6b7280; padding: 3px 0; width: 25%;">Sanctioned</td>
              <td style="font-weight: 600; width: 25%;">${formatCurrency(acct.sanctionAmount)}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; padding: 3px 0;">Balance</td>
              <td style="font-weight: 600;">${formatCurrency(acct.currentBalance)}</td>
              <td style="color: #6b7280; padding: 3px 0;">Past Due</td>
              <td style="font-weight: 600; ${acct.pastDueAmount > 0 ? "color: #dc2626;" : ""}">${formatCurrency(acct.pastDueAmount)}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; padding: 3px 0;">Date Opened</td>
              <td style="font-weight: 500;">${formatDate(acct.dateOpened)}</td>
              <td style="color: #6b7280; padding: 3px 0;">${acct.dateClosed ? "Date Closed" : "EMI Amount"}</td>
              <td style="font-weight: 500;">${acct.dateClosed ? formatDate(acct.dateClosed) : (acct.emiAmount > 0 ? formatCurrency(acct.emiAmount) : "N/A")}</td>
            </tr>
          </table>
          ${acct.paymentHistory.length > 0 ? `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #f3f4f6;">
              <div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">Payment History (Last 24 Months)</div>
              <div style="display: flex; gap: 2px; flex-wrap: wrap;">${historyBars}</div>
              <div style="display: flex; gap: 12px; margin-top: 4px; font-size: 10px; color: #9ca3af;">
                <span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #22c55e; margin-right: 3px;"></span>Current</span>
                <span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #eab308; margin-right: 3px;"></span>1-30 DPD</span>
                <span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #f97316; margin-right: 3px;"></span>30-90 DPD</span>
                <span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #dc2626; margin-right: 3px;"></span>Write-off</span>
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  // Enquiries
  const enquirySummaryHtml = `
    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
      <div style="flex: 1; text-align: center; padding: 10px; background: #f9fafb; border-radius: 6px;">
        <div style="font-size: 20px; font-weight: 700;">${enq.total30Days}</div>
        <div style="font-size: 11px; color: #6b7280;">Last 30 Days</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 10px; background: #f9fafb; border-radius: 6px;">
        <div style="font-size: 20px; font-weight: 700;">${enq.total90Days}</div>
        <div style="font-size: 11px; color: #6b7280;">Last 90 Days</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 10px; background: #f9fafb; border-radius: 6px;">
        <div style="font-size: 20px; font-weight: 700;">${enq.totalAll}</div>
        <div style="font-size: 11px; color: #6b7280;">Total</div>
      </div>
    </div>
  `;

  const enquiryListHtml = enq.list.length > 0 ? `
    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Date</th>
          <th style="text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Institution</th>
          <th style="text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Purpose</th>
          <th style="text-align: right; padding: 6px 8px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${enq.list.map(enq => `
          <tr>
            <td style="padding: 5px 8px; border-bottom: 1px solid #f3f4f6;">${formatDate(enq.date)}</td>
            <td style="padding: 5px 8px; border-bottom: 1px solid #f3f4f6;">${enq.institution}</td>
            <td style="padding: 5px 8px; border-bottom: 1px solid #f3f4f6;">${enq.purpose}</td>
            <td style="padding: 5px 8px; border-bottom: 1px solid #f3f4f6; text-align: right;">${enq.amount > 0 ? formatCurrency(enq.amount) : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : '<div style="font-size: 12px; color: #6b7280; text-align: center; padding: 12px;">No enquiries found</div>';

  const enquiriesHtml = `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px; page-break-inside: avoid;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Credit Enquiries</h3>
      ${enquirySummaryHtml}
      ${enquiryListHtml}
    </div>
  `;

  // Full document
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; padding: 0; line-height: 1.4;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #2563eb;">
        <h1 style="margin: 0; font-size: 20px; color: #1e40af;">Credit Bureau Report</h1>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          ${data.scoreType} &middot; Generated on ${formatDate(data.reportDate)} &middot; Report #${data.reportOrderNo || "N/A"}
        </div>
      </div>

      ${personalInfoHtml}
      ${contactHtml}
      ${summaryHtml}

      <!-- Account Details -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Account Details (${accts.length})</h3>
        ${accountsHtml}
      </div>

      ${enquiriesHtml}

      <!-- Footer -->
      <div style="text-align: center; font-size: 10px; color: #9ca3af; padding-top: 12px; border-top: 1px solid #e5e7eb;">
        This report is generated from ${data.scoreType} credit bureau data. For official records, refer to the original bureau report.
      </div>
    </div>
  `;
}

export function downloadCreditReportPdf(data: CreditReportData) {
  const container = document.createElement("div");
  container.innerHTML = buildHtml(data);
  // Keep on-screen but invisible so html2canvas can capture painted content
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "794px"; // A4 width at 96dpi
  container.style.zIndex = "-1";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const personalInfo = data.personalInfo || (data as any).personal_info || { name: "", pan: "" };
  const filename = `Credit-Report-${personalInfo.name?.replace(/\s+/g, "-") || "Applicant"}-${personalInfo.pan || "NA"}.pdf`;

  const opt = {
    margin: [10, 12, 10, 12],
    filename,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
    pagebreak: { mode: ["css", "legacy"] },
  };

  html2pdf()
    .set(opt)
    .from(container)
    .save()
    .then(() => {
      document.body.removeChild(container);
    });
}
