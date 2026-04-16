import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToR2 } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// State code mapping for Equifax API
const STATE_CODES: Record<string, string> = {
  "andhra pradesh": "AP",
  "arunachal pradesh": "AR",
  "assam": "AS",
  "bihar": "BR",
  "chhattisgarh": "CG",
  "goa": "GA",
  "gujarat": "GJ",
  "haryana": "HR",
  "himachal pradesh": "HP",
  "jharkhand": "JH",
  "karnataka": "KA",
  "kerala": "KL",
  "madhya pradesh": "MP",
  "maharashtra": "MH",
  "manipur": "MN",
  "meghalaya": "ML",
  "mizoram": "MZ",
  "nagaland": "NL",
  "odisha": "OD",
  "orissa": "OD",
  "punjab": "PB",
  "rajasthan": "RJ",
  "sikkim": "SK",
  "tamil nadu": "TN",
  "tamilnadu": "TN",
  "telangana": "TS",
  "tripura": "TR",
  "uttar pradesh": "UP",
  "uttarakhand": "UK",
  "west bengal": "WB",
  "andaman and nicobar islands": "AN",
  "chandigarh": "CH",
  "dadra and nagar haveli": "DN",
  "daman and diu": "DD",
  "delhi": "DL",
  "new delhi": "DL",
  "jammu and kashmir": "JK",
  "ladakh": "LA",
  "lakshadweep": "LD",
  "puducherry": "PY",
  "pondicherry": "PY",
};

// Pincode prefix to state code mapping for fallback
const PINCODE_STATE_MAP: Record<string, string> = {
  "11": "DL", "12": "HR", "13": "PB", "14": "HP", "15": "JK",
  "16": "PB", "17": "HP", "18": "JK", "19": "JK",
  "20": "UP", "21": "UP", "22": "UP", "23": "UP", "24": "UP",
  "25": "UP", "26": "UP", "27": "UP", "28": "UP",
  "30": "RJ", "31": "RJ", "32": "RJ", "33": "RJ", "34": "RJ",
  "36": "CG", "37": "AP", "38": "GJ", "39": "GJ",
  "40": "MH", "41": "MH", "42": "MH", "43": "MH", "44": "MH",
  "45": "MP", "46": "MP", "47": "MP", "48": "MP", "49": "CG",
  "50": "TS", "51": "TS", "52": "AP", "53": "AP",
  "56": "KA", "57": "KA", "58": "KA", "59": "KA",
  "60": "TN", "61": "TN", "62": "TN", "63": "TN", "64": "TN",
  "67": "KL", "68": "KL", "69": "KL",
  "70": "WB", "71": "WB", "72": "WB", "73": "WB", "74": "WB",
  "75": "OD", "76": "OD", "77": "OD",
  "78": "AS", "79": "AR",
  "80": "BR", "81": "BR", "82": "BR", "83": "BR", "84": "BR",
  "85": "JH", "86": "JH",
};

// Hit code descriptions
const HIT_CODES: Record<string, string> = {
  "10": "Hit - Records found",
  "11": "No Hit - No records found",
  "12": "ACGI - Age Criteria Not Met",
  "13": "ID Scrub Failed",
  "14": "File Frozen",
  "15": "System Error",
  "01": "Hit - Records found (legacy)",
  "02": "No Hit - No records found (legacy)",
};

// Payment status codes
const PAYMENT_STATUS: Record<string, { label: string; severity: "current" | "dpd" | "severe" | "writeoff" }> = {
  "000": { label: "Current", severity: "current" },
  "STD": { label: "Standard", severity: "current" },
  "XXX": { label: "Not Reported", severity: "current" },
  "NEW": { label: "New Account", severity: "current" },
  "SMA": { label: "Special Mention Account", severity: "dpd" },
  "SUB": { label: "Sub-Standard", severity: "severe" },
  "DBT": { label: "Doubtful", severity: "severe" },
  "LSS": { label: "Loss", severity: "writeoff" },
  "WOF": { label: "Written Off", severity: "writeoff" },
  "CLSD": { label: "Closed", severity: "current" },
};

function getStateFromPincode(pincode: string): string {
  if (!pincode || pincode.length < 2) return "";
  return PINCODE_STATE_MAP[pincode.substring(0, 2)] || "";
}

function getStateCode(state: string, pincode?: string): string {
  if (!state && !pincode) return "";
  const normalized = state?.toLowerCase().trim() || "";
  if (normalized.length === 2) return normalized.toUpperCase();
  const directMatch = STATE_CODES[normalized];
  if (directMatch) return directMatch;
  if (pincode) {
    const fromPincode = getStateFromPincode(pincode);
    if (fromPincode) {
      console.log(`[EQUIFAX] State "${state}" not found, inferred ${fromPincode} from pincode ${pincode}`);
      return fromPincode;
    }
  }
  console.log(`[EQUIFAX] Could not determine state for "${state}" pincode "${pincode}"`);
  return state ? state.substring(0, 2).toUpperCase() : "";
}

// Known city to state mapping for parsing freeform addresses
const CITY_STATE_MAP: Record<string, string> = {
  "mumbai": "MH", "delhi": "DL", "new delhi": "DL", "bangalore": "KA", "bengaluru": "KA",
  "hyderabad": "TS", "ahmedabad": "GJ", "chennai": "TN", "kolkata": "WB", "pune": "MH",
  "jaipur": "RJ", "lucknow": "UP", "kanpur": "UP", "nagpur": "MH", "indore": "MP",
  "thane": "MH", "bhopal": "MP", "visakhapatnam": "AP", "vadodara": "GJ", "ghaziabad": "UP",
  "ludhiana": "PB", "agra": "UP", "nashik": "MH", "faridabad": "HR", "meerut": "UP",
  "rajkot": "GJ", "varanasi": "UP", "srinagar": "JK", "aurangabad": "MH", "dhanbad": "JH",
  "amritsar": "PB", "navi mumbai": "MH", "allahabad": "UP", "prayagraj": "UP",
  "ranchi": "JH", "howrah": "WB", "coimbatore": "TN", "jabalpur": "MP", "gwalior": "MP",
  "vijayawada": "AP", "jodhpur": "RJ", "madurai": "TN", "raipur": "CG", "kota": "RJ",
  "chandigarh": "CH", "gurgaon": "HR", "gurugram": "HR", "noida": "UP", "greater noida": "UP",
  "guwahati": "AS", "solapur": "MH", "hubli": "KA", "mysore": "KA", "mysuru": "KA",
  "tiruchirappalli": "TN", "bareilly": "UP", "aligarh": "UP", "tiruppur": "TN",
  "moradabad": "UP", "jalandhar": "PB", "bhubaneswar": "OD", "salem": "TN",
  "warangal": "TS", "guntur": "AP", "bhiwandi": "MH", "saharanpur": "UP",
  "gorakhpur": "UP", "bikaner": "RJ", "amravati": "MH", "noida": "UP",
  "jamshedpur": "JH", "bhilai": "CG", "cuttack": "OD", "firozabad": "UP",
  "kochi": "KL", "ernakulam": "KL", "thiruvananthapuram": "KL", "trivandrum": "KL",
  "dehradun": "UK", "patna": "BR", "panaji": "GA", "shimla": "HP",
  "surat": "GJ", "nanded": "MH", "kolhapur": "MH", "ajmer": "RJ",
  "udaipur": "RJ", "mangalore": "KA", "mangaluru": "KA", "belgaum": "KA", "belagavi": "KA",
  "sangli": "MH", "latur": "MH", "satara": "MH",
};

/**
 * Parse a freeform address string like "Any Address, Gurgaon, Haryana 122002"
 * into structured { line1, city, state, pincode } components.
 */
function parseFreeformAddress(raw: string): { line1: string; city: string; state: string; pincode: string } {
  const result = { line1: raw, city: "", state: "", pincode: "" };
  if (!raw) return result;

  // Extract 6-digit pincode
  const pincodeMatch = raw.match(/\b(\d{6})\b/);
  if (pincodeMatch) {
    result.pincode = pincodeMatch[1];
  }

  // Split by commas and work backwards (rightmost parts are usually state, city)
  const parts = raw.split(",").map(p => p.trim());

  // Try to find state from parts
  for (let i = parts.length - 1; i >= 0; i--) {
    // Remove pincode from the part for matching
    const cleaned = parts[i].replace(/\b\d{6}\b/, "").trim().toLowerCase();
    if (!cleaned) continue;

    // Check direct state name match
    if (STATE_CODES[cleaned]) {
      result.state = STATE_CODES[cleaned];
      break;
    }
    // Check if part contains a state name
    for (const [stateName, stateCode] of Object.entries(STATE_CODES)) {
      if (cleaned.includes(stateName)) {
        result.state = stateCode;
        break;
      }
    }
    if (result.state) break;
  }

  // Try to find city from parts
  for (let i = parts.length - 1; i >= 0; i--) {
    const cleaned = parts[i].replace(/\b\d{6}\b/, "").trim().toLowerCase();
    if (!cleaned) continue;
    // Skip if this part was the state
    if (result.state && STATE_CODES[cleaned] === result.state) continue;

    if (CITY_STATE_MAP[cleaned]) {
      result.city = parts[i].replace(/\b\d{6}\b/, "").trim();
      // Also derive state from city if not found yet
      if (!result.state) {
        result.state = CITY_STATE_MAP[cleaned];
      }
      break;
    }
    // Check for city name embedded in the part (e.g. "Near Gurgaon Station")
    for (const [cityName, stateCode] of Object.entries(CITY_STATE_MAP)) {
      if (cleaned.includes(cityName) && cityName.length >= 4) {
        result.city = cityName.charAt(0).toUpperCase() + cityName.slice(1);
        if (!result.state) result.state = stateCode;
        break;
      }
    }
    if (result.city) break;
  }

  // Derive state from pincode if still missing
  if (!result.state && result.pincode) {
    result.state = getStateFromPincode(result.pincode);
  }

  return result;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr;
}

function parseDPDFromPaymentHistory(history: string): number {
  if (!history) return 0;
  const dpdMatch = history.match(/(\d{3})/);
  return dpdMatch ? parseInt(dpdMatch[1], 10) : 0;
}

/**
 * Build the 7 IDDetails slots required by PCS format.
 * PAN=T, Passport=P, Voter=V, DL=D, Aadhaar=M, Ration=R, Other=O
 */
function buildIDDetails(panNumber: string, aadhaarNumber: string): any[] {
  const details: any[] = [];
  let seq = 1;
  if (panNumber) {
    details.push({ seq: String(seq++), IDType: "T", IDValue: panNumber });
  }
  if (aadhaarNumber) {
    details.push({ seq: String(seq++), IDType: "M", IDValue: aadhaarNumber.replace(/\s/g, "") });
  }
  return details;
}

/**
 * Parse PCS CIR 360 JSON response from Equifax
 */
function parseEquifaxResponse(response: any): any {
  try {
    console.log("[EQUIFAX-PARSE] Top-level keys:", Object.keys(response));

    // CCRResponse path (CIR 360 JSON / PCS format)
    const ccrResponse = response?.CCRResponse;
    const inProfileResponse = response?.INProfileResponse;

    let inquiryResponse: any = {};
    let header: any = {};
    let scoreDetails: any = {};

    if (ccrResponse?.CIRReportDataLst?.[0]) {
      console.log("[EQUIFAX-PARSE] Using CCRResponse path (PCS CIR 360)");
      inquiryResponse = ccrResponse.CIRReportDataLst[0];
      header = inquiryResponse.InquiryResponseHeader || response.InquiryResponseHeader || {};

      // Score: root level or inside CIRReportDataLst item
      const rootScore = response.Score;
      const itemScore = inquiryResponse.Score;
      const scoreArray = rootScore || itemScore || [];
      scoreDetails = scoreArray[0] || {};

      console.log("[EQUIFAX-PARSE] Root Score:", JSON.stringify(rootScore)?.substring(0, 300));
      console.log("[EQUIFAX-PARSE] HitCode:", header.HitCode);
    } else if (inProfileResponse?.CIRReportDataLst?.[0]) {
      console.log("[EQUIFAX-PARSE] Using INProfileResponse path (legacy)");
      inquiryResponse = inProfileResponse.CIRReportDataLst[0];
      header = inquiryResponse.CIRReportData?.Header || {};
      scoreDetails = inquiryResponse.CIRReportData?.ScoreDetails?.[0] || {};
    } else {
      console.error("[EQUIFAX-PARSE] CIRReportDataLst not found. CCRResponse:", JSON.stringify(ccrResponse)?.substring(0, 500));
      throw new Error("Invalid response structure - CIRReportDataLst not found");
    }

    const cirReportData = inquiryResponse.CIRReportData || {};

    // Score extraction: check CIRReportData.ScoreDetails if root score has no numeric value
    console.log("[EQUIFAX-PARSE] cirReportData.ScoreDetails:", JSON.stringify(cirReportData.ScoreDetails)?.substring(0, 300));
    if (!scoreDetails?.Score && !scoreDetails?.Value) {
      const cirScoreArr = cirReportData.ScoreDetails;
      const cirScore = Array.isArray(cirScoreArr) ? cirScoreArr[0] : cirScoreArr;
      if (cirScore?.Score || cirScore?.Value) {
        scoreDetails = cirScore;
        console.log("[EQUIFAX-PARSE] Found score in CIRReportData.ScoreDetails:", JSON.stringify(scoreDetails));
      }
    }

    // RetailAccountsSummary - handle both spellings (with/without trailing "s")
    const retailAccountsSummary = cirReportData.RetailAccountsSummary
      || cirReportData.RetailAccountSummary
      || {};

    const retailAccountDetails = cirReportData.RetailAccountDetails || [];
    const enquirySummary = cirReportData.EnquirySummary || {};
    const enquiries = cirReportData.Enquiries || [];
    const idAndContactInfo = cirReportData.IDAndContactInfo || {};
    const personalInfo = idAndContactInfo.PersonalInfo || {};

    // Personal details
    const name = personalInfo.Name || {};
    const fullName = [name.FirstName, name.MiddleName, name.LastName].filter(Boolean).join(" ");

    // Parse accounts - LIMIT to 15
    const maxAccounts = 15;
    const accountsToProcess = retailAccountDetails.slice(0, maxAccounts);
    const accounts = accountsToProcess.map((acc: any, accIndex: number) => {
      if (accIndex === 0) {
        console.log("[EQUIFAX-PARSE] First account keys:", Object.keys(acc).join(", "));
      }

      const history48MonthsRaw = acc.History48Months;
      const paymentHistory: any[] = [];

      // CIR 360 JSON: array of objects; Legacy: string
      if (Array.isArray(history48MonthsRaw)) {
        const recentHistory = history48MonthsRaw.slice(0, 12);
        recentHistory.forEach((item: any) => {
          const status = item.PaymentStatus || "*";
          paymentHistory.push({
            month: item.key || "",
            status,
            label: PAYMENT_STATUS[status]?.label || status,
            severity: PAYMENT_STATUS[status]?.severity || "current",
          });
        });
      } else if (typeof history48MonthsRaw === "string" && history48MonthsRaw.length > 0) {
        const maxChars = Math.min(history48MonthsRaw.length, 36);
        for (let i = 0; i < maxChars; i += 3) {
          const status = history48MonthsRaw.substring(i, i + 3);
          paymentHistory.push({
            month: Math.floor(i / 3) + 1,
            status,
            label: PAYMENT_STATUS[status]?.label || status,
            severity: PAYMENT_STATUS[status]?.severity || "current",
          });
        }
      }

      // Institution name: check multiple field names
      const institutionName = acc.SubscriberName
        || acc.InstitutionName
        || acc.ReportingMemberShortName
        || acc.MemberShortName
        || acc.Institution
        || "Unknown";

      // Determine account status: use Open field ("Yes"/"No") alongside AccountStatus
      let accountStatus = acc.AccountStatus || "Unknown";
      if (acc.Open === "No" && accountStatus !== "Closed" && accountStatus !== "CLOSED") {
        accountStatus = "Closed";
      }

      return {
        institution: institutionName,
        accountType: acc.AccountType || "Unknown",
        ownershipType: acc.OwnershipType || "Individual",
        accountNumber: acc.AccountNumber || "",
        status: accountStatus,
        sanctionAmount: parseFloat(acc.SanctionAmount) || 0,
        currentBalance: parseFloat(acc.Balance || acc.CurrentBalance) || 0,
        pastDueAmount: parseFloat(acc.PastDueAmount || acc.AmountPastDue) || 0,
        emiAmount: parseFloat(acc.InstallmentAmount) || 0,
        highCredit: parseFloat(acc.HighCredit) || 0,
        creditLimit: parseFloat(acc.CreditLimit) || 0,
        interestRate: parseFloat(acc.InterestRate) || 0,
        collateralValue: parseFloat(acc.CollateralValue) || 0,
        collateralType: acc.CollateralType || "",
        assetClassification: acc.AssetClassification || "",
        dateOpened: acc.DateOpened || "",
        dateClosed: acc.DateClosed || "",
        dateReported: acc.DateReported || "",
        lastPaymentDate: acc.LastPaymentDate || "",
        paymentHistory,
        rawHistory: Array.isArray(history48MonthsRaw)
          ? `array:${history48MonthsRaw.length} months`
          : (history48MonthsRaw || ""),
      };
    });

    // Summary calculations
    const activeAccounts = accounts.filter((a: any) =>
      !["Closed", "CLOSED", "Written Off"].includes(a.status)
    );
    const closedAccounts = accounts.filter((a: any) =>
      ["Closed", "CLOSED"].includes(a.status)
    );
    const writeOffAccounts = accounts.filter((a: any) =>
      a.status === "Written Off" || a.status === "WOF"
    );

    // Enquiries
    const parsedEnquiries = enquiries.map((enq: any) => ({
      date: enq.Date || "",
      institution: enq.Institution || "",
      purpose: enq.Purpose || "",
      amount: parseFloat(enq.Amount) || 0,
    }));

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const enquiries30Days = parsedEnquiries.filter((e: any) => new Date(e.date) >= thirtyDaysAgo).length;
    const enquiries90Days = parsedEnquiries.filter((e: any) => new Date(e.date) >= ninetyDaysAgo).length;

    // Credit score - multiple locations
    const creditScore = parseInt(scoreDetails.Score) || parseInt(scoreDetails.Value)
      || parseInt(cirReportData.ScoreCard?.Score) || parseInt(cirReportData.Scores?.[0]?.Value) || 0;

    console.log("[EQUIFAX-PARSE] Final credit score:", creditScore);

    return {
      reportOrderNo: header.ReportOrderNO || "",
      reportDate: header.Date || header.ReportDate || new Date().toISOString(),
      creditScore,
      scoreType: scoreDetails.Type || "ERS",
      scoreVersion: scoreDetails.Version || "4.0",
      hitCode: header.HitCode || "10",
      hitDescription: HIT_CODES[header.HitCode] || "Unknown",
      summary: {
        totalAccounts: accounts.length,
        activeAccounts: activeAccounts.length,
        closedAccounts: closedAccounts.length,
        writeOffAccounts: writeOffAccounts.length,
        totalOutstanding: parseFloat(retailAccountsSummary.TotalBalanceAmount || retailAccountsSummary.CurrentBalance) ||
          accounts.reduce((sum: number, a: any) => sum + a.currentBalance, 0),
        totalPastDue: parseFloat(retailAccountsSummary.TotalPastDue || retailAccountsSummary.AmountPastDue) ||
          accounts.reduce((sum: number, a: any) => sum + a.pastDueAmount, 0),
        totalSanctioned: parseFloat(retailAccountsSummary.TotalSanctionAmount || retailAccountsSummary.SanctionAmount) ||
          accounts.reduce((sum: number, a: any) => sum + a.sanctionAmount, 0),
        oldestAccountDate: retailAccountsSummary.OldestAccount || "",
        recentAccountDate: retailAccountsSummary.RecentAccount || "",
        totalCreditLimit: parseFloat(retailAccountsSummary.TotalCreditLimit) || 0,
        totalMonthlyPayment: parseFloat(retailAccountsSummary.TotalMonthlyPaymentAmount) || 0,
      },
      accounts,
      enquiries: {
        total30Days: enquiries30Days,
        total90Days: enquiries90Days,
        totalAll: parsedEnquiries.length,
        list: parsedEnquiries,
      },
      personalInfo: {
        name: fullName.trim(),
        dob: personalInfo.DateOfBirth || "",
        pan: idAndContactInfo.IdentityInfo?.PANId?.[0]?.IdNumber
          || idAndContactInfo.PANId?.[0]?.IdNumber || "",
        gender: personalInfo.Gender || "",
        totalIncome: personalInfo.TotalIncome || "",
        addresses: (idAndContactInfo.AddressInfo || []).map((addr: any) =>
          [addr.Address, addr.City, addr.State, addr.Postal].filter(Boolean).join(", ")
        ),
        phones: (idAndContactInfo.PhoneInfo || []).map((phone: any) => phone.Number),
      },
    };
  } catch (error) {
    console.error("Error parsing Equifax response:", error);
    throw new Error("Failed to parse credit report response");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { applicantId, applicationId, orgId } = body;

    if (!applicantId || !applicationId || !orgId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: applicantId, applicationId, orgId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch applicant data
    const { data: applicant, error: applicantError } = await supabase
      .from("loan_applicants")
      .select("*")
      .eq("id", applicantId)
      .single();

    if (applicantError || !applicant) {
      return new Response(
        JSON.stringify({ success: false, error: "Applicant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse current_address JSONB, fall back to permanent_address
    const rawAddress = applicant.current_address || applicant.permanent_address;
    let addressLine1 = "";
    let addressCity = "";
    let addressState = "";
    let addressPincode = "";

    if (typeof rawAddress === 'object' && rawAddress !== null) {
      addressLine1 = (rawAddress as any).line1 || "";
      addressCity = (rawAddress as any).city || "";
      addressState = (rawAddress as any).state || "";
      addressPincode = (rawAddress as any).pincode || "";
    } else if (typeof rawAddress === 'string') {
      addressLine1 = rawAddress;
    }

    console.log("[EQUIFAX] Raw address source:", applicant.current_address ? "current_address" : (applicant.permanent_address ? "permanent_address" : "none"));

    // Parse freeform line1 into structured components when city/state/pincode are missing
    if (addressLine1 && (!addressCity || !addressState || !addressPincode)) {
      const parsed = parseFreeformAddress(addressLine1);
      if (!addressCity && parsed.city) {
        addressCity = parsed.city;
        console.log("[EQUIFAX] Parsed city from line1:", addressCity);
      }
      if (!addressState && parsed.state) {
        addressState = parsed.state;
        console.log("[EQUIFAX] Parsed state from line1:", addressState);
      }
      if (!addressPincode && parsed.pincode) {
        addressPincode = parsed.pincode;
        console.log("[EQUIFAX] Parsed pincode from line1:", addressPincode);
      }
    }

    // Validate we have minimum address data for Equifax
    if (!addressLine1) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Address is required for Equifax credit bureau check. Please add the applicant's current address before pulling the report.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const applicantData = {
      firstName: applicant.first_name || "",
      middleName: applicant.middle_name || "",
      lastName: applicant.last_name || "",
      dob: applicant.dob || "",
      panNumber: applicant.pan_number || "",
      aadhaarNumber: applicant.aadhaar_number || "",
      mobile: applicant.mobile || "",
      gender: applicant.gender || "",
      address: {
        line1: addressLine1,
        city: addressCity,
        state: addressState,
        postal: addressPincode,
      },
    };

    console.log("[EQUIFAX] Address:", applicantData.address);

    // Get Equifax credentials
    const customerId = Deno.env.get("EQUIFAX_CUSTOMER_ID");
    const userId = Deno.env.get("EQUIFAX_USER_ID");
    const password = Deno.env.get("EQUIFAX_PASSWORD");
    const memberNumber = Deno.env.get("EQUIFAX_MEMBER_NUMBER");
    const securityCode = Deno.env.get("EQUIFAX_SECURITY_CODE");
    const apiUrl = Deno.env.get("EQUIFAX_API_URL");

    console.log("[EQUIFAX] Credentials check:", {
      hasCustomerId: !!customerId,
      hasUserId: !!userId,
      hasPassword: !!password,
      hasMemberNumber: !!memberNumber,
      hasSecurityCode: !!securityCode,
      hasApiUrl: !!apiUrl,
    });

    // All credentials required - no mock data fallback
    if (!customerId || !userId || !password || !apiUrl) {
      const missing = [];
      if (!customerId) missing.push("EQUIFAX_CUSTOMER_ID");
      if (!userId) missing.push("EQUIFAX_USER_ID");
      if (!password) missing.push("EQUIFAX_PASSWORD");
      if (!apiUrl) missing.push("EQUIFAX_API_URL");
      throw new Error(`Missing Equifax credentials: ${missing.join(", ")}. Please configure them in settings.`);
    }

    // Build request - IDCR JSON format
    const stateCode = getStateCode(applicantData.address.state, applicantData.address.postal);
    console.log("[EQUIFAX] State code:", stateCode);

    // Build RequestBody matching IDCR sample format exactly
    const requestBody: any = {
      InquiryPurpose: "00",
      TransactionAmount: "0",
      FirstName: applicantData.firstName,
      MiddleName: applicantData.middleName || "",
      LastName: applicantData.lastName || "",
      InquiryAddresses: [{
        seq: "1",
        AddressLine1: applicantData.address.line1,
        AddressLine2: "",
        Locality: applicantData.address.city,
        City: applicantData.address.city,
        State: stateCode,
        AddressType: ["H"],
        Postal: applicantData.address.postal,
      }],
      InquiryPhones: [{
        seq: "1",
        Number: applicantData.mobile,
        PhoneType: ["M"],
      }],
      EmailAddresses: [{
        seq: "1",
        Email: "",
        EmailType: ["O"],
      }],
      IDDetails: buildIDDetails(applicantData.panNumber, applicantData.aadhaarNumber),
      DOB: formatDate(applicantData.dob),
      Gender: applicantData.gender === "female" ? "F" : "M",
      CustomFields: [
        { key: "EmbeddedPdf", value: "Y" },
      ],
    };

    const equifaxRequest = {
      RequestHeader: {
        CustomerId: customerId,
        UserId: userId,
        Password: password,
        MemberNumber: memberNumber,
        SecurityCode: securityCode,
        CustRefField: applicationId,
        ProductCode: ["IDCR"],
      },
      RequestBody: requestBody,
      Score: [{ Type: "ERS", Version: "4.0" }],
    };

    let reportData;
    let rawApiResponse: any = null;

    try {
      console.log("[EQUIFAX] ========== SENDING IDCR JSON REQUEST VIA AZURE PROXY ==========");

      const redactedBody = JSON.stringify(equifaxRequest)
        .replace(/"Password":"[^"]*"/g, '"Password":"***REDACTED***"')
        .replace(/"SecurityCode":"[^"]*"/g, '"SecurityCode":"***REDACTED***"');
      console.log("[EQUIFAX] Request (redacted):", redactedBody);

      // Route through Azure VM proxy for static IP (98.70.57.225 - Central India)
      const proxyUrl = "http://98.70.57.225/equifax-proxy";
      console.log("[EQUIFAX] Proxying through:", proxyUrl);

      const proxyResponse = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(equifaxRequest),
      });

      if (!proxyResponse.ok) {
        const errText = await proxyResponse.text();
        console.error("[EQUIFAX] Proxy HTTP error:", proxyResponse.status, errText);
        throw new Error(`Proxy request failed (${proxyResponse.status}): ${errText}`);
      }

      const responseText = await proxyResponse.text();
      console.log("[EQUIFAX] Response length:", responseText.length);
      if (responseText.length < 500) {
        console.log("[EQUIFAX] Full response:", responseText);
      } else {
        console.log("[EQUIFAX] Response preview:", responseText.substring(0, 500));
      }

      if (responseText.length === 0) {
        throw new Error("Equifax API returned empty response (IP may not be whitelisted yet)");
      }

      try {
        rawApiResponse = JSON.parse(responseText);
        console.log("[EQUIFAX] Response keys:", Object.keys(rawApiResponse));
      } catch (parseError: any) {
        console.error("[EQUIFAX] Raw response (first 1000 chars):", responseText.substring(0, 1000));
        throw new Error(`Failed to parse Equifax response as JSON (len=${responseText.length}): ${responseText.substring(0, 200)}`);
      }

      // Check for API error response
      if (rawApiResponse?.Error?.ErrorCode) {
        const errorCode = rawApiResponse.Error.ErrorCode;
        const errorDesc = rawApiResponse.Error.ErrorDesc || "Unknown error";
        console.error("[EQUIFAX] API Error:", errorCode, errorDesc);
        throw new Error(`Equifax API Error ${errorCode}: ${errorDesc}`);
      }

      reportData = parseEquifaxResponse(rawApiResponse);
      reportData.rawResponse = rawApiResponse;
      reportData.requestFormat = "json";
      console.log("[EQUIFAX] Credit Score:", reportData.creditScore, "Hit Code:", reportData.hitCode);

      // Extract, decrypt, and store embedded PDF if present
      const encodedPdf = rawApiResponse.EncodedPdf;
      if (encodedPdf) {
        try {
          console.log("[EQUIFAX] Found EncodedPdf, decrypting...");

          // Build password: {CustomerID}{MonthAbbrev}{Year}
          const now = new Date();
          const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const pdfPassword = `${customerId}${monthNames[now.getMonth()]}${now.getFullYear()}`;

          // Decrypt via Azure VM service
          const decryptResponse = await fetch("http://98.70.57.225/decrypt-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdf_base64: encodedPdf, password: pdfPassword }),
          });
          const decryptResult = await decryptResponse.json();

          let pdfBytes: Uint8Array;
          if (decryptResult.success) {
            console.log("[EQUIFAX] PDF decrypted successfully");
            pdfBytes = Uint8Array.from(atob(decryptResult.pdf_base64), c => c.charCodeAt(0));
          } else {
            console.warn("[EQUIFAX] PDF decryption failed, saving encrypted version:", decryptResult.error);
            pdfBytes = Uint8Array.from(atob(encodedPdf), c => c.charCodeAt(0));
          }

          try {
            const r2Key = `loan-docs/${orgId}/${applicationId}/equifax_report_${Date.now()}.pdf`;
            reportData.report_file_path = await uploadToR2(r2Key, pdfBytes, "application/pdf");
            console.log("[EQUIFAX] PDF saved to R2:", r2Key);
          } catch (r2Err) {
            console.error("[EQUIFAX] R2 upload error:", r2Err);
          }
        } catch (pdfErr: any) {
          console.error("[EQUIFAX] PDF extraction error:", pdfErr.message);
        }
      } else {
        console.log("[EQUIFAX] No EncodedPdf in response");
      }

    } catch (apiError: any) {
      console.error("[EQUIFAX] API call failed:", apiError.message);
      throw new Error(`Failed to fetch credit report: ${apiError.message}`);
    }

    // Build redacted request for storage - matches actual request structure
    const redactedRequestForStorage = {
      RequestHeader: {
        CustomerId: customerId,
        UserId: userId,
        Password: "***REDACTED***",
        MemberNumber: memberNumber,
        SecurityCode: "***REDACTED***",
        CustRefField: applicationId,
        ProductCode: ["IDCR"],
      },
      RequestBody: {
        InquiryPurpose: "00",
        FirstName: applicantData.firstName,
        ...(applicantData.middleName ? { MiddleName: applicantData.middleName } : {}),
        ...(applicantData.lastName ? { LastName: applicantData.lastName } : {}),
        DOB: formatDate(applicantData.dob),
        InquiryAddresses: [{
          seq: "1",
          AddressType: ["H"],
          AddressLine1: applicantData.address.line1,
          State: stateCode,
          Postal: applicantData.address.postal,
        }],
        InquiryPhones: [{
          seq: "1",
          Number: applicantData.mobile,
          PhoneType: ["M"],
        }],
        IDDetails: buildIDDetails(applicantData.panNumber, applicantData.aadhaarNumber).map(id => ({
          ...id,
          IDValue: id.IDType === "T" && id.IDValue ? id.IDValue.substring(0, 3) + "***" : id.IDValue ? "***" : "",
        })),
      },
      Score: [{ Type: "ERS", Version: "4.0" }],
    };

    console.log("[EQUIFAX] ========== SAVING TO DATABASE ==========");

    const verificationData = {
      loan_application_id: applicationId,
      applicant_id: applicantId,
      verification_type: "credit_bureau",
      verification_source: "equifax",
      status: (reportData.hitCode === "10" || reportData.hitCode === "01") ? "success" : "failed",
      request_data: {
        bureau_type: "equifax",
        pan_number: applicantData.panNumber,
        request_timestamp: new Date().toISOString(),
        full_request: redactedRequestForStorage,
        api_url_used: apiUrl,
        request_format: "idcr_json",
      },
      response_data: {
        bureau_type: "equifax",
        credit_score: reportData.creditScore,
        score_type: reportData.scoreType,
        score_version: reportData.scoreVersion,
        hit_code: reportData.hitCode,
        hit_description: reportData.hitDescription,
        report_order_no: reportData.reportOrderNo,
        report_date: reportData.reportDate,
        summary: reportData.summary,
        accounts: reportData.accounts,
        enquiries: reportData.enquiries,
        personal_info: reportData.personalInfo,
        active_accounts: reportData.summary.activeAccounts,
        total_outstanding: reportData.summary.totalOutstanding,
        total_overdue: reportData.summary.totalPastDue,
        enquiry_count_30d: reportData.enquiries.total30Days,
        enquiry_count_90d: reportData.enquiries.total90Days,
        name_on_report: reportData.personalInfo.name,
        pan_on_report: reportData.personalInfo.pan,
        report_file_path: reportData.report_file_path || null,
        is_live_fetch: true,
        is_mock: false,
        raw_api_response: {
          summary: "Full response parsed into structured data above",
          hitCode: reportData?.hitCode,
          accountCount: reportData?.accounts?.length || 0,
          hasPdf: !!reportData.report_file_path,
        },
        debug_info: {
          response_timestamp: new Date().toISOString(),
          response_format: "idcr_json",
        }
      },
      remarks: (reportData.hitCode === "10" || reportData.hitCode === "01")
        ? `Credit score: ${reportData.creditScore} (${reportData.scoreType} ${reportData.scoreVersion})`
        : `No records found: ${reportData.hitDescription}`,
      verified_at: new Date().toISOString(),
      org_id: orgId,
    };

    // Upsert verification
    const { data: existingVerification } = await supabase
      .from("loan_verifications")
      .select("id")
      .eq("loan_application_id", applicationId)
      .eq("verification_type", "credit_bureau")
      .single();

    if (existingVerification) {
      const { error: updateError } = await supabase
        .from("loan_verifications")
        .update(verificationData)
        .eq("id", existingVerification.id);
      if (updateError) {
        console.error("[EQUIFAX] DB update failed:", JSON.stringify(updateError));
        // Retry without org_id in case of constraint issue
        const { org_id, ...dataWithoutOrg } = verificationData;
        const { error: retryError } = await supabase
          .from("loan_verifications")
          .update(dataWithoutOrg)
          .eq("id", existingVerification.id);
        if (retryError) {
          console.error("[EQUIFAX] DB update retry also failed:", JSON.stringify(retryError));
        }
      }
    } else {
      const { error: insertError } = await supabase
        .from("loan_verifications")
        .insert(verificationData);
      if (insertError) {
        console.error("[EQUIFAX] DB insert failed:", JSON.stringify(insertError));
        // Retry without org_id
        const { org_id, ...dataWithoutOrg } = verificationData;
        const { error: retryError } = await supabase
          .from("loan_verifications")
          .insert(dataWithoutOrg);
        if (retryError) {
          console.error("[EQUIFAX] DB insert retry also failed:", JSON.stringify(retryError));
        }
      }
    }

    // Strip large fields before sending to frontend
    const { rawResponse, ...clientData } = reportData;
    return new Response(
      JSON.stringify({ success: true, data: clientData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in equifax-credit-report:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
