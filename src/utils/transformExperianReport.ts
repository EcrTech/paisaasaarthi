/**
 * Transform Experian raw response (from VerifiedU API) into the format
 * expected by the CreditReportViewer component.
 *
 * The input is the `raw_response` field stored by the verifiedu-credit-report
 * edge function, which contains the full INProfileResponse from Experian.
 */

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

const ACCOUNT_STATUS_MAP: Record<string, string> = {
  "11": "Current",
  "12": "1-89 Days Past Due",
  "13": "Closed",
  "14": "Voluntarily Closed",
  "21": "Sub-standard",
  "22": "Doubtful",
  "23": "Loss",
  "31": "Willful Default",
  "32": "Suit Filed / Willful Default",
  "40": "Suit Filed",
  "51": "Settled",
  "52": "Post Write-off Settled",
  "53": "Account Sold",
  "54": "Post Write-off / Account Sold",
  "61": "Restructured",
  "71": "Written Off",
  "72": "Written Off and Settled",
  "73": "Written Off and Account Sold",
  "80": "Suit Filed",
  "82": "Suit Filed and Written Off",
  "83": "Suit Filed and Settled",
  "84": "Suit Filed, Written Off, and Settled",
};

const ACCOUNT_TYPE_MAP: Record<string, string> = {
  "00": "Other",
  "01": "Auto Loan",
  "02": "Housing Loan",
  "03": "Property Loan",
  "04": "Loan Against Shares/Securities",
  "05": "Personal Loan",
  "06": "Consumer Loan",
  "07": "Gold Loan",
  "08": "Education Loan",
  "09": "Loan Against Bank Deposits",
  "10": "Credit Card",
  "11": "Secured Credit Card",
  "12": "Fleet Card",
  "13": "Kisan Credit Card",
  "14": "Prime Minister Jeevan Jyoti Bima Yojana",
  "15": "Mudra - Shishu",
  "16": "Mudra - Kishore",
  "17": "Mudra - Tarun",
  "18": "Business Loan - Secured",
  "19": "Business Loan - Unsecured (General)",
  "20": "Telco - Wireless",
  "21": "Telco - Broadband",
  "22": "Telco - Landline",
  "31": "Secured Credit Card",
  "32": "Used Car Loan",
  "33": "Construction Equipment Loan",
  "34": "Tractor Loan",
  "35": "Corporate Credit Card",
  "36": "Two-Wheeler Loan",
  "37": "Commercial Vehicle Loan",
  "38": "Loan to Professional",
  "39": "Personal Loan - Unsecured",
  "40": "Loan Against FD / NCD",
  "41": "Microfinance - Business Loan",
  "42": "Microfinance - Personal Loan",
  "43": "Microfinance - Housing Loan",
  "44": "Microfinance - Other",
  "51": "Business Non-Funded Credit Facility",
  "52": "Business Loan Against Bank Deposits",
  "53": "Staff Loan",
  "61": "Business Loan - Secured",
  "89": "Overdraft",
};

const OWNERSHIP_TYPE_MAP: Record<string, string> = {
  "1": "Individual",
  "2": "Joint",
  "3": "Authorized User",
  "7": "Guarantor",
};

const GENDER_MAP: Record<string, string> = {
  "1": "Male",
  "2": "Female",
  "3": "Transgender",
};

const ENQUIRY_REASON_MAP: Record<string, string> = {
  "01": "Auto Loan",
  "02": "Housing Loan",
  "03": "Property Loan",
  "05": "Personal Loan",
  "06": "Consumer Loan",
  "07": "Gold Loan",
  "08": "Education Loan",
  "10": "Credit Card",
  "31": "Secured Credit Card",
  "36": "Two-Wheeler Loan",
  "37": "Commercial Vehicle Loan",
  "51": "Non-Funded Credit Facility",
  "00": "Other",
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Convert YYYYMMDD to YYYY-MM-DD. Returns empty string for invalid input.
 */
function formatDate(raw: string | undefined | null): string {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = raw.replace(/\D/g, "");
  if (cleaned.length !== 8) return raw;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
}

/**
 * Safely parse a string to number, returning 0 for invalid / empty values.
 */
function safeInt(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  return isNaN(n) ? 0 : n;
}

function safeFloat(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

/**
 * Normalise an array field that might come as a single object instead of an array.
 */
function ensureArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Map a DPD value to a severity bucket used by the CreditReportViewer.
 */
function dpdToSeverity(
  dpd: number,
  assetClassification?: string
): "current" | "dpd" | "severe" | "writeoff" {
  // Written-off asset classifications
  const woClassifications = ["D", "L", "S", "DBT", "LSS", "SMA"];
  if (
    assetClassification &&
    woClassifications.includes(assetClassification.toUpperCase())
  ) {
    return "writeoff";
  }
  if (dpd === 0 || dpd === -1) return "current"; // -1 sometimes means "no info"
  if (dpd >= 1 && dpd <= 30) return "dpd";
  if (dpd >= 31 && dpd <= 90) return "severe";
  return "writeoff"; // >90
}

/**
 * Derive a human-readable label for DPD values.
 */
function dpdLabel(dpd: number): string {
  if (dpd === 0) return "On Time";
  if (dpd === -1) return "No Data";
  return `${dpd} DPD`;
}

/**
 * Map an Account_Status code to a readable status string.
 */
function mapAccountStatus(code: string | undefined | null): string {
  if (!code) return "Unknown";
  return ACCOUNT_STATUS_MAP[String(code)] || `Status ${code}`;
}

/**
 * Map Account_Type code to a readable type string.
 */
function mapAccountType(code: string | undefined | null): string {
  if (!code) return "Unknown";
  return ACCOUNT_TYPE_MAP[String(code)] || `Type ${code}`;
}

// ---------------------------------------------------------------------------
// Main transform function
// ---------------------------------------------------------------------------

export function transformExperianToViewerFormat(rawResponse: any) {
  const profile = rawResponse?.INProfileResponse ?? rawResponse;
  const header = profile?.Header ?? {};
  const creditProfileHeader = profile?.CreditProfileHeader ?? {};
  const scoreSection = profile?.SCORE ?? {};
  const caisAccount = profile?.CAIS_Account ?? {};
  const caisSummary = caisAccount?.CAIS_Summary ?? {};
  const creditAccount = caisSummary?.Credit_Account ?? {};
  const outstandingBalance = caisSummary?.Total_Outstanding_Balance ?? {};
  const capsSection = profile?.CAPS ?? {};
  const capsSummary = profile?.TotalCAPS_Summary ?? {};
  const currentApp = profile?.Current_Application ?? {};

  // ------ Report-level fields ------
  const reportOrderNo =
    creditProfileHeader?.ReportNumber ||
    header?.ReportOrderNO ||
    "";
  const reportDate = formatDate(
    creditProfileHeader?.ReportDate || header?.ReportDate
  );
  const creditScore = safeInt(scoreSection?.BureauScore);
  const scoreVersion = scoreSection?.BureauScoreConfidLevel || undefined;

  // Hit code: Experian does not have a standard hit code field, so we derive
  // one from whether accounts exist.
  const totalAccounts = safeInt(creditAccount?.CreditAccountTotal);
  const hitCode = totalAccounts > 0 ? "01" : "14";
  const hitDescription =
    totalAccounts > 0 ? "Hit - Report found" : "No Hit - No records found";

  // ------ Account details ------
  const accountDetails = ensureArray(caisAccount?.CAIS_Account_DETAILS);

  // Compute summary values from both the summary block and individual accounts
  const activeAccounts = safeInt(creditAccount?.CreditAccountActive);
  const closedAccounts = safeInt(creditAccount?.CreditAccountClosed);
  const defaultAccounts = safeInt(creditAccount?.CreditAccountDefault);

  // Count write-off accounts from individual account statuses
  let writeOffAccounts = 0;
  let totalPastDue = 0;
  let totalSanctioned = 0;
  let totalCreditLimit = 0;
  let totalMonthlyPayment = 0;
  let oldestDate: string | undefined;
  let recentDate: string | undefined;

  const transformedAccounts = accountDetails.map((acct: any) => {
    const statusCode = String(acct?.Account_Status ?? "");
    const isWriteOff = ["71", "72", "73", "82", "84"].includes(statusCode);
    if (isWriteOff) writeOffAccounts++;

    const sanctionAmount =
      safeFloat(acct?.Highest_Credit_or_Original_Loan_Amount) ||
      safeFloat(acct?.Credit_Limit_Amount);
    const currentBalance = safeFloat(acct?.Current_Balance);
    const pastDueAmount = safeFloat(acct?.Amount_Past_Due);
    const emiAmount = safeFloat(acct?.Scheduled_Monthly_Payment_Amount);

    totalPastDue += pastDueAmount;
    totalSanctioned += sanctionAmount;
    totalCreditLimit += safeFloat(acct?.Credit_Limit_Amount);
    totalMonthlyPayment += emiAmount;

    const dateOpened = formatDate(acct?.Open_Date);
    const dateClosed = formatDate(acct?.Date_Closed) || undefined;
    const dateReported = formatDate(acct?.Date_Reported) || undefined;

    // Track oldest / most recent account dates
    if (dateOpened) {
      if (!oldestDate || dateOpened < oldestDate) oldestDate = dateOpened;
      if (!recentDate || dateOpened > recentDate) recentDate = dateOpened;
    }

    // Payment history from CAIS_Account_History
    const historyRecords = ensureArray(acct?.CAIS_Account_History);
    const paymentHistory = historyRecords
      .map((h: any) => {
        const dpd = safeInt(h?.Days_Past_Due);
        const month = safeInt(h?.Month);
        const year = safeInt(h?.Year);
        const assetClassification = h?.Asset_Classification;
        return {
          month: year * 100 + month, // YYYYMM for sorting
          status: dpd === 0 ? "On Time" : `${dpd} DPD`,
          label: dpdLabel(dpd),
          severity: dpdToSeverity(dpd, assetClassification),
        };
      })
      // Sort descending by month (most recent first)
      .sort(
        (a: { month: number }, b: { month: number }) => b.month - a.month
      );

    // Ownership type
    const ownershipCode = acct?.AccountHoldertypeCode;
    const ownershipType =
      OWNERSHIP_TYPE_MAP[String(ownershipCode)] || "Individual";

    return {
      institution: acct?.Subscriber_Name?.trim() || "Unknown",
      accountType: mapAccountType(acct?.Account_Type),
      ownershipType,
      accountNumber: acct?.Account_Number || "",
      status: mapAccountStatus(statusCode),
      sanctionAmount,
      currentBalance,
      pastDueAmount,
      emiAmount,
      dateOpened,
      dateClosed,
      dateReported,
      paymentHistory,
    };
  });

  // ------ Total outstanding from summary block (prefer explicit values) ------
  const totalOutstanding =
    safeFloat(outstandingBalance?.Outstanding_Balance_All) ||
    safeFloat(creditAccount?.CADSuitFiledCurrentBalance) ||
    transformedAccounts.reduce(
      (sum: number, a: { currentBalance: number }) => sum + a.currentBalance,
      0
    );

  // ------ Enquiries ------
  const capsApplications = ensureArray(capsSection?.CAPS_Application_Details);
  const enquiryList = capsApplications.map((enq: any) => ({
    date: formatDate(enq?.Date_of_Request),
    institution: enq?.Subscriber_Name?.trim() || "Unknown",
    purpose:
      ENQUIRY_REASON_MAP[String(enq?.Enquiry_Reason)] ||
      enq?.Enquiry_Reason ||
      "Unknown",
    amount: safeFloat(enq?.Amount_Financed),
  }));

  const total30Days = safeInt(capsSummary?.TotalCAPSLast30Days);
  const total90Days = safeInt(capsSummary?.TotalCAPSLast90Days);
  const totalAll = enquiryList.length || safeInt(capsSummary?.TotalCAPSLast180Days);

  // ------ Personal info (from first account's holder details) ------
  let name = "";
  let dob = "";
  let pan = "";
  let gender = "";
  const addresses: string[] = [];
  const phones: string[] = [];

  // Try Current_Application first — Experian nests it at
  // Current_Application.Current_Application_Details.Current_Applicant_Details
  const currentAppDetails = currentApp?.Current_Application_Details;
  const currentApplicant = currentAppDetails?.Current_Applicant_Details;
  if (currentApplicant?.First_Name) {
    name = [
      currentApplicant.First_Name,
      currentApplicant.Middle_Name1 || currentApplicant.Middle_Name,
      currentApplicant.Last_Name || currentApplicant.Surname,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    // Also extract PAN, DOB, gender from Current_Applicant_Details as fallback
    if (currentApplicant.IncomeTaxPan) {
      pan = currentApplicant.IncomeTaxPan;
    }
    if (currentApplicant.Date_Of_Birth_Applicant) {
      dob = formatDate(String(currentApplicant.Date_Of_Birth_Applicant));
    }
    if (currentApplicant.Gender_Code) {
      gender = GENDER_MAP[String(currentApplicant.Gender_Code)] || "";
    }
  }

  // Then supplement / override from first account's CAIS_Holder_Details
  if (accountDetails.length > 0) {
    const holderDetails = ensureArray(accountDetails[0]?.CAIS_Holder_Details);
    if (holderDetails.length > 0) {
      const holder = holderDetails[0];
      if (!name) {
        name = [
          holder.First_Name_Non_Normalized,
          holder.Middle_Name_Non_Normalized,
          holder.Surname_Non_Normalized,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
      }
      dob = formatDate(holder.Date_of_birth);
      pan = holder.Income_TAX_PAN || "";
      gender = GENDER_MAP[String(holder.Gender_Code)] || "";
    }

    // Collect all unique addresses
    const seenAddresses = new Set<string>();
    for (const acct of accountDetails) {
      const addrDetails = ensureArray(acct?.CAIS_Holder_Address_Details);
      for (const addr of addrDetails) {
        const parts = [
          addr?.First_Line_Of_Address_non_normalized,
          addr?.Second_Line_Of_Address_non_normalized,
          addr?.Third_Line_Of_Address_non_normalized,
          addr?.Fourth_Line_Of_Address_non_normalized,
          addr?.Fifth_Line_Of_Address_non_normalized,
          addr?.City_non_normalized,
          addr?.State_non_normalized,
          addr?.ZIP_Postal_Code_non_normalized,
        ].filter(Boolean);
        if (parts.length > 0) {
          const full = parts.join(", ");
          if (!seenAddresses.has(full)) {
            seenAddresses.add(full);
            addresses.push(full);
          }
        }
      }
    }

    // Collect all unique phones and emails
    const seenPhones = new Set<string>();
    for (const acct of accountDetails) {
      const phoneDetails = ensureArray(acct?.CAIS_Holder_Phone_Details);
      for (const ph of phoneDetails) {
        const num = ph?.Telephone_Number || ph?.Mobile_Telephone_Number || "";
        if (num && !seenPhones.has(num)) {
          seenPhones.add(num);
          phones.push(num);
        }
        const email = ph?.EMailId;
        if (email && !seenPhones.has(email)) {
          seenPhones.add(email);
          phones.push(email);
        }
      }
    }
  }

  // ------ Assemble the output ------
  return {
    reportOrderNo,
    reportDate,
    creditScore,
    scoreType: "Experian",
    scoreVersion: scoreVersion || undefined,
    hitCode,
    hitDescription,
    summary: {
      totalAccounts,
      activeAccounts,
      closedAccounts,
      writeOffAccounts,
      totalOutstanding,
      totalPastDue,
      totalSanctioned,
      oldestAccountDate: oldestDate,
      recentAccountDate: recentDate,
      totalCreditLimit: totalCreditLimit || undefined,
      totalMonthlyPayment: totalMonthlyPayment || undefined,
    },
    accounts: transformedAccounts,
    enquiries: {
      total30Days,
      total90Days,
      totalAll,
      list: enquiryList,
    },
    personalInfo: {
      name,
      dob,
      pan,
      gender,
      addresses: addresses.length > 0 ? addresses : undefined,
      phones: phones.length > 0 ? phones : undefined,
    },
  };
}
