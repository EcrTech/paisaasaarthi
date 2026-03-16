/**
 * Analytics Utility Module for Google Ads & Meta Pixel Tracking
 * 
 * Google Ads ID: AW-17871680753
 * Meta Pixel ID: 2454408188319767
 */

// Constants
export const GOOGLE_ADS_ID = 'AW-17871680753';
export const META_PIXEL_ID = '2454408188319767';

// Google Ads Conversion IDs (4-step funnel)
export const GOOGLE_CONVERSION_SIGNUP = 'AW-17871680753/CxRBCL6C2u8bEPHp8MlC';        // Step 1: Sign-up
export const GOOGLE_CONVERSION_ADD_TO_CART = 'AW-17871680753/4Bc0CJqkzu8bEPHp8MlC';    // Step 2: Add to Cart (PAN verified)
export const GOOGLE_CONVERSION_BEGIN_CHECKOUT = 'AW-17871680753/LIRBCNXA1e8bEPHp8MlC'; // Step 3: Begin Checkout (Aadhaar/DigiLocker)
export const GOOGLE_CONVERSION_PURCHASE = 'AW-17871680753/O8oJCNz54u8bEPHp8MlC';       // Step 4: Purchase (Video KYC + submission)

// Legacy alias
export const GOOGLE_CONVERSION_VIDEO_KYC = GOOGLE_CONVERSION_PURCHASE;

/**
 * Safe wrapper for gtag - ensures it's available before calling
 */
export function gtag(command: string, ...args: any[]): void {
  if (typeof window !== 'undefined' && window.gtag) {
    (window.gtag as any)(command, ...args);
  } else {
    console.debug('[Analytics] gtag not available');
  }
}

/**
 * Safe wrapper for fbq - ensures it's available before calling
 */
export function fbq(command: string, ...args: any[]): void {
  if (typeof window !== 'undefined' && window.fbq) {
    (window.fbq as any)(command, ...args);
  } else {
    console.debug('[Analytics] fbq not available');
  }
}

/**
 * Track Google Ads conversion event
 * @param conversionId - Full conversion ID (e.g., 'AW-17871680753/O8oJCNz54u8bEPHp8MlC')
 * @param options - Optional conversion parameters
 */
export function trackGoogleConversion(
  conversionId: string,
  options?: {
    value?: number;
    currency?: string;
    transactionId?: string;
  }
): void {
  console.log('[Analytics] Google Ads conversion:', conversionId, options);
  
  gtag('event', 'conversion', {
    send_to: conversionId,
    value: options?.value ?? 1.0,
    currency: options?.currency ?? 'INR',
    transaction_id: options?.transactionId,
  });
}

/**
 * Track Meta (Facebook) standard event
 * @param eventName - Standard event name
 * @param params - Optional event parameters
 */
export function trackMetaEvent(
  eventName: 'PageView' | 'SubmitApplication' | 'CompleteRegistration' | 'Purchase' | 'Lead' | 'InitiateCheckout',
  params?: {
    content_name?: string;
    content_ids?: string[];
    value?: number;
    currency?: string;
    status?: string;
    [key: string]: any;
  }
): void {
  console.log('[Analytics] Meta event:', eventName, params);
  fbq('track', eventName, params);
}

/**
 * Track Meta custom event (for non-standard events)
 * @param eventName - Custom event name
 * @param params - Optional event parameters
 */
export function trackMetaCustomEvent(
  eventName: string,
  params?: Record<string, any>
): void {
  console.log('[Analytics] Meta custom event:', eventName, params);
  fbq('trackCustom', eventName, params);
}

/**
 * Track loan application step progression
 * Used for funnel analysis on both Google and Meta
 * @param step - Step number (1-4 for referral, 1-7 for public)
 * @param stepName - Human-readable step name
 * @param flowType - 'referral' or 'public'
 */
export function trackLoanStep(
  step: number,
  stepName: string,
  flowType: 'referral' | 'public' = 'referral'
): void {
  console.log('[Analytics] Loan step:', { step, stepName, flowType });
  
  // Google Analytics event
  gtag('event', 'loan_step_view', {
    event_category: 'Loan Application',
    event_label: `${flowType}_step_${step}_${stepName}`,
    value: step,
  });
  
  // Meta custom event for funnel tracking
  trackMetaCustomEvent('LoanApplicationStep', {
    step_number: step,
    step_name: stepName,
    flow_type: flowType,
  });
}

/**
 * Track final loan application conversion
 * Fires the primary Google Ads conversion and Meta Purchase event
 * @param applicationId - Application/transaction ID
 * @param amount - Loan amount (for value optimization)
 * @param flowType - 'referral' or 'public'
 */
export function trackLoanConversion(
  applicationId: string,
  amount?: number,
  flowType: 'referral' | 'public' = 'referral'
): void {
  console.log('[Analytics] Loan conversion:', { applicationId, amount, flowType });
  
  // Google Ads final conversion (Video KYC completion)
  trackGoogleConversion(GOOGLE_CONVERSION_VIDEO_KYC, {
    value: amount ?? 1.0,
    currency: 'INR',
    transactionId: applicationId,
  });
  
  // Meta Purchase event
  trackMetaEvent('Purchase', {
    content_name: 'Loan Application',
    content_ids: [applicationId],
    value: amount ?? 0,
    currency: 'INR',
  });
}

/**
 * Track Video KYC completion
 * This is the primary conversion event for Google Ads
 * @param applicationId - Application ID
 */
export function trackVideoKYCComplete(applicationId: string): void {
  console.log('[Analytics] Video KYC complete:', applicationId);

  // Meta CompleteRegistration
  trackMetaEvent('CompleteRegistration', {
    content_name: 'Video KYC',
    status: 'complete',
    content_ids: [applicationId],
  });
}

/**
 * Track PAN verification success
 * @param applicationId - Optional application ID if available
 */
export function trackPANVerified(applicationId?: string): void {
  console.log('[Analytics] PAN verified:', applicationId);

  // Google Ads Add to Cart conversion (Step 2)
  trackGoogleConversion(GOOGLE_CONVERSION_ADD_TO_CART, {
    transactionId: applicationId,
  });

  // Google Analytics event
  gtag('event', 'pan_verified', {
    event_category: 'Verification',
    event_label: 'PAN',
  });

  // Meta Lead event
  trackMetaEvent('Lead', {
    content_name: 'PAN Verification',
    status: 'verified',
  });
}

/**
 * Track Aadhaar/DigiLocker verification initiated
 */
export function trackAadhaarInitiated(): void {
  console.log('[Analytics] Aadhaar verification initiated');

  // Google Ads Begin Checkout conversion (Step 3)
  trackGoogleConversion(GOOGLE_CONVERSION_BEGIN_CHECKOUT);

  // Google Analytics event
  gtag('event', 'aadhaar_initiated', {
    event_category: 'Verification',
    event_label: 'DigiLocker',
  });

  // Meta InitiateCheckout (verification flow)
  trackMetaEvent('InitiateCheckout', {
    content_name: 'Aadhaar DigiLocker',
  });
}

/**
 * Track Aadhaar verification success
 */
export function trackAadhaarVerified(): void {
  console.log('[Analytics] Aadhaar verified');
  
  // Google Analytics event
  gtag('event', 'aadhaar_verified', {
    event_category: 'Verification',
    event_label: 'DigiLocker Success',
  });
  
  // Meta custom event
  trackMetaCustomEvent('AadhaarVerified', {
    status: 'success',
  });
}

/**
 * Track referral form Step 1 completion (SubmitApplication)
 * @param loanAmount - Requested loan amount
 */
export function trackReferralFormStart(loanAmount?: number): void {
  console.log('[Analytics] Referral form start:', loanAmount);
  
  // Meta SubmitApplication event
  trackMetaEvent('SubmitApplication', {
    content_name: 'Referral Loan Application',
    value: loanAmount,
    currency: 'INR',
  });
  
  // Track step
  trackLoanStep(1, 'basic_info', 'referral');
}

/**
 * Track referral Step 1 lead submission (fires both Google & Meta pixels)
 * Called when user completes the first screen (Loan Amount, Name, Phone)
 * @param loanAmount - Requested loan amount
 * @param utmParams - Captured UTM parameters for source attribution
 */
export function trackReferralStep1Lead(
  loanAmount?: number,
  utmParams?: { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null }
): void {
  console.log('[Analytics] Referral Step 1 Lead:', { loanAmount, utmParams });

  // Google Ads Sign-up conversion (Step 1)
  trackGoogleConversion(GOOGLE_CONVERSION_SIGNUP, {
    value: loanAmount ?? 1.0,
    currency: 'INR',
  });

  // Google Analytics event
  gtag('event', 'step1_lead_form', {
    event_category: 'Loan Application',
    event_label: 'referral_step_1_basic_info',
    value: loanAmount,
    utm_source: utmParams?.utm_source || undefined,
    utm_medium: utmParams?.utm_medium || undefined,
    utm_campaign: utmParams?.utm_campaign || undefined,
  });

  // Meta SubmitApplication event (Step 1)
  trackMetaEvent('SubmitApplication', {
    content_name: 'Referral Loan Application',
    value: loanAmount,
    currency: 'INR',
  });

  // Meta Lead event
  trackMetaEvent('Lead', {
    content_name: 'Referral Loan Step 1',
    value: loanAmount,
    currency: 'INR',
    status: 'lead_form_submit',
  });
}
