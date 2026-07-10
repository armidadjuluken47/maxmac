<?php
/**
 * VPS geo endpoint — same contract as frontend/functions/api/geo.js (Cloudflare Pages).
 *
 * Served at GET /api/geo by the frontend Nginx vhost.
 * Reads Cloudflare's CF-IPCountry when the site is proxied through Cloudflare; otherwise
 * returns { country: null, currency: null } and the Astro client falls back to browser locale.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=3600');

$map = [
	// East / Southern Africa
	'KE' => 'KES', 'TZ' => 'TZS', 'UG' => 'UGX', 'RW' => 'RWF', 'ET' => 'ETB', 'ZA' => 'ZAR', 'ZM' => 'ZMW',
	'ZW' => 'ZWL', 'BW' => 'BWP', 'NA' => 'NAD', 'MZ' => 'MZN', 'MW' => 'MWK', 'MU' => 'MUR', 'SC' => 'SCR',
	// West / Central / North Africa
	'NG' => 'NGN', 'GH' => 'GHS', 'EG' => 'EGP', 'MA' => 'MAD', 'DZ' => 'DZD', 'TN' => 'TND', 'CI' => 'XOF',
	'SN' => 'XOF', 'CM' => 'XAF', 'AO' => 'AOA',
	// Eurozone
	'DE' => 'EUR', 'FR' => 'EUR', 'IT' => 'EUR', 'ES' => 'EUR', 'NL' => 'EUR', 'BE' => 'EUR', 'AT' => 'EUR',
	'IE' => 'EUR', 'PT' => 'EUR', 'FI' => 'EUR', 'GR' => 'EUR', 'LU' => 'EUR', 'SK' => 'EUR', 'SI' => 'EUR',
	'EE' => 'EUR', 'LV' => 'EUR', 'LT' => 'EUR', 'CY' => 'EUR', 'MT' => 'EUR', 'HR' => 'EUR',
	// Rest of Europe
	'GB' => 'GBP', 'CH' => 'CHF', 'NO' => 'NOK', 'SE' => 'SEK', 'DK' => 'DKK', 'PL' => 'PLN', 'CZ' => 'CZK',
	'HU' => 'HUF', 'RO' => 'RON', 'BG' => 'BGN', 'IS' => 'ISK', 'UA' => 'UAH', 'RU' => 'RUB', 'TR' => 'TRY',
	// Americas
	'US' => 'USD', 'CA' => 'CAD', 'MX' => 'MXN', 'BR' => 'BRL', 'AR' => 'ARS', 'CL' => 'CLP', 'CO' => 'COP',
	'PE' => 'PEN', 'UY' => 'UYU',
	// Middle East
	'AE' => 'AED', 'SA' => 'SAR', 'QA' => 'QAR', 'KW' => 'KWD', 'BH' => 'BHD', 'OM' => 'OMR', 'IL' => 'ILS',
	'JO' => 'JOD', 'LB' => 'LBP',
	// Asia-Pacific
	'IN' => 'INR', 'CN' => 'CNY', 'JP' => 'JPY', 'KR' => 'KRW', 'HK' => 'HKD', 'SG' => 'SGD', 'MY' => 'MYR',
	'TH' => 'THB', 'ID' => 'IDR', 'PH' => 'PHP', 'VN' => 'VND', 'PK' => 'PKR', 'BD' => 'BDT', 'LK' => 'LKR',
	'AU' => 'AUD', 'NZ' => 'NZD',
];

$country = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? null;
if ( ! $country || $country === 'XX' || $country === 'T1' ) {
	$country = null;
}

$currency = ( $country && isset( $map[ $country ] ) ) ? $map[ $country ] : null;

echo json_encode(
	[
		'country'  => $country,
		'currency' => $currency,
	],
	JSON_UNESCAPED_UNICODE
);
