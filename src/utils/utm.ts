/**
 * UTM Parameter Capture Utility
 * Extracts marketing source parameters from the URL for analytics tracking
 */

export interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/**
 * Extract UTM parameters from the current URL query string
 */
export function captureUTMParams(): UTMParams {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  };
}

/**
 * Map UTM source to a human-readable marketing source name
 */
export function getMarketingSource(utmParams?: UTMParams | null): string {
  if (!utmParams?.utm_source) return 'Direct';

  // Strip anything after '&' in case the utm_source contains extra params
  const rawSource = utmParams.utm_source.split('&')[0].trim();

  const sourceMap: Record<string, string> = {
    google: 'Google Ads',
    'google-ads': 'Google Ads',
    'google ads': 'Google Ads',
    facebook: 'Meta Ads',
    fb: 'Meta Ads',
    instagram: 'Instagram',
    meta: 'Meta Ads',
    linkedin: 'LinkedIn',
    twitter: 'Twitter',
    organic: 'Organic Search',
    direct: 'Direct',
  };

  return sourceMap[rawSource.toLowerCase()] || rawSource;
}
