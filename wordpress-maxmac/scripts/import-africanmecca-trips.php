<?php
/**
 * Import AfricanMecca packages into WP Travel Engine as real `trip` posts.
 *
 * Usage (from wordpress-maxmac/):
 *   php scripts/import-africanmecca-trips.php
 *   php scripts/import-africanmecca-trips.php --dry-run
 *   php scripts/import-africanmecca-trips.php --limit=5 --countries=kenya,tanzania
 *
 * Requires: frontend/src/data/africanmecca-import.json (run scripts/import-africanmecca.mjs first)
 */

if ( php_sapi_name() !== 'cli' ) {
	exit( 'CLI only.' );
}

define( 'WP_USE_THEMES', false );
require dirname( __DIR__ ) . '/wp-load.php';

use WPTravelEngine\Core\Models\Post\Trip;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
$dry_run   = in_array( '--dry-run', $argv, true );
$limit     = 0;
$countries = array();
foreach ( $argv as $arg ) {
	if ( str_starts_with( $arg, '--limit=' ) ) {
		$limit = (int) substr( $arg, 8 );
	}
	if ( str_starts_with( $arg, '--countries=' ) ) {
		$countries = array_filter( array_map( 'trim', explode( ',', substr( $arg, 12 ) ) ) );
	}
}

$json_path = dirname( __DIR__ ) . '/../frontend/src/data/africanmecca-import.json';
if ( ! file_exists( $json_path ) ) {
	fwrite( STDERR, "Missing {$json_path}. Run: node scripts/import-africanmecca.mjs\n" );
	exit( 1 );
}

$data     = json_decode( file_get_contents( $json_path ), true );
$packages = $data['packages'] ?? array();

if ( $countries ) {
	$packages = array_values(
		array_filter(
			$packages,
			function ( $p ) use ( $countries ) {
				$slug = strtolower( str_replace( ' ', '-', $p['dest'] ?? '' ) );
				foreach ( $countries as $c ) {
					if (
						str_contains( $p['slug'] ?? '', "ams-{$c}-" )
						|| str_contains( $p['slug'] ?? '', "ams-beach-{$c}-" )
						|| str_contains( $p['slug'] ?? '', "ams-safari-{$c}-" )
						|| $slug === $c
					) {
						return true;
					}
				}
				return false;
			}
		)
	);
}

if ( $limit > 0 ) {
	$packages = array_slice( $packages, 0, $limit );
}

// USD → store currency (KES by default).
$usd_to_kes = (float) ( getenv( 'AMS_USD_TO_KES' ) ?: 130 );

// Map country names → WTE destination term slug (created if missing).
$dest_map = array(
	'Kenya'        => 'kenya',
	'Tanzania'     => 'tanzania',
	'Zanzibar'     => 'zanzibar',
	'Kenyan Coast' => 'kenyan-coast',
	'Uganda'       => 'uganda',
	'Rwanda'       => 'rwanda',
	'Botswana'     => 'botswana',
	'Zambia'       => 'zambia',
	'South Africa' => 'south-africa',
	'East Africa'  => 'kenya',
);

$activity_map = array(
	'Wildlife safari' => 'wildlife-safari',
	'Beach & coast'   => 'beach-coast',
	'Trekking'        => 'trekking',
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ams_ensure_term( string $taxonomy, string $slug, string $name ): int {
	$term = get_term_by( 'slug', $slug, $taxonomy );
	if ( $term && ! is_wp_error( $term ) ) {
		return (int) $term->term_id;
	}
	$result = wp_insert_term( $name, $taxonomy, array( 'slug' => $slug ) );
	if ( is_wp_error( $result ) ) {
		fwrite( STDERR, "Term error ({$taxonomy}/{$slug}): " . $result->get_error_message() . "\n" );
		return 0;
	}
	return (int) $result['term_id'];
}

function ams_trip_exists( string $source_url ): int {
	$q = new WP_Query(
		array(
			'post_type'      => 'trip',
			'post_status'    => array( 'publish', 'draft', 'pending' ),
			'posts_per_page' => 1,
			'meta_key'       => '_ams_source_url',
			'meta_value'     => $source_url,
			'fields'         => 'ids',
		)
	);
	return $q->posts[0] ?? 0;
}

function ams_sideload_image( string $url, int $post_id, string $title ): int {
	if ( ! $url || ! filter_var( $url, FILTER_VALIDATE_URL ) ) {
		return 0;
	}
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$tmp = download_url( $url, 30 );
	if ( is_wp_error( $tmp ) ) {
		return 0;
	}
	$file = array(
		'name'     => basename( parse_url( $url, PHP_URL_PATH ) ) ?: 'trip.jpg',
		'tmp_name' => $tmp,
	);
	$id = media_handle_sideload( $file, $post_id, $title );
	if ( is_wp_error( $id ) ) {
		@unlink( $tmp );
		return 0;
	}
	return (int) $id;
}

function ams_build_overview( array $pkg ): string {
	$parts = array();
	$blurb = wp_strip_all_tags( $pkg['blurb'] ?? '' );
	if ( $blurb ) {
		$parts[] = esc_html( $blurb );
	}
	$areas = $pkg['areasVisited'] ?? array();
	if ( is_string( $areas ) ) {
		$areas = array_filter( array_map( 'trim', explode( ',', $areas ) ) );
	}
	if ( $areas ) {
		$parts[] = '<strong>Areas visited:</strong> ' . esc_html( implode( ', ', $areas ) );
	}
	if ( empty( $parts ) ) {
		$parts[] = esc_html( sprintf( 'Imported safari itinerary. Source: %s', $pkg['sourceUrl'] ?? '' ) );
	}
	$body = '';
	foreach ( $parts as $p ) {
		$body .= "<!-- wp:paragraph -->\n<p>{$p}</p>\n<!-- /wp:paragraph -->\n";
	}
	return trim( $body );
}

function ams_paragraph_block( string $text ): string {
	$text = trim( wp_strip_all_tags( $text ) );
	if ( ! $text ) {
		return '';
	}
	$para = esc_html( $text );
	return "<!-- wp:paragraph -->\n<p>{$para}</p>\n<!-- /wp:paragraph -->";
}

function ams_default_includes(): string {
	return implode(
		"\n\n",
		array(
			'Professional safari guiding and park fees as listed in the itinerary.',
			'Accommodation in selected camps or lodges on the chosen tier.',
			'Meals as specified by each property (typically full board on safari).',
			'Ground transfers between parks and airstrips as per the route.',
			'Conservation and community levies where applicable.',
		)
	);
}

function ams_default_excludes(): string {
	return implode(
		"\n\n",
		array(
			'International flights and visa fees.',
			'Travel insurance and medical evacuation cover.',
			'Personal expenses, drinks, and laundry unless stated.',
			'Optional activities (balloon safaris, spa, etc.) unless included.',
			'Tips and gratuities for guides, drivers, and camp staff.',
		)
	);
}

/** Map imported JSON into WP Travel Engine's wp_travel_engine_setting shape. */
function ams_build_wte_settings( array $pkg, int $trip_id ): array {
	$days  = max( 1, (int) ( $pkg['days'] ?? 1 ) );
	$title = $pkg['name'] ?? 'Safari';

	$highlights = array();
	foreach ( $pkg['highlights'] ?? array() as $h ) {
		$text = is_string( $h ) ? $h : ( $h['text'] ?? $h['title'] ?? '' );
		$text = wp_strip_all_tags( (string) $text );
		if ( $text ) {
			$highlights[] = array( 'highlight_text' => $text );
		}
	}
	if ( empty( $highlights ) ) {
		$areas = $pkg['areasVisited'] ?? array();
		if ( is_string( $areas ) ) {
			$areas = array_filter( array_map( 'trim', explode( ',', $areas ) ) );
		}
		foreach ( $areas as $area ) {
			$highlights[] = array( 'highlight_text' => $area );
		}
	}

	$itinerary = array(
		'itinerary_title'       => array(),
		'itinerary_days_label'  => array(),
		'itinerary_content'     => array(),
	);
	$idx = 1;
	foreach ( $pkg['itinerary'] ?? array() as $day ) {
		$day_title = wp_strip_all_tags( (string) ( $day['title'] ?? "Day {$idx}" ) );
		$day_desc  = (string) ( $day['desc'] ?? '' );
		$itinerary['itinerary_title'][ (string) $idx ]      = $day_title;
		$itinerary['itinerary_days_label'][ (string) $idx ] = sprintf( 'Day %02d', $idx );
		$itinerary['itinerary_content'][ (string) $idx ]  = ams_paragraph_block( $day_desc );
		++$idx;
	}

	$includes_list = array_filter(
		array_map(
			static fn( $s ) => wp_strip_all_tags( (string) $s ),
			(array) ( $pkg['includes'] ?? array() )
		)
	);
	$excludes_list = array_filter(
		array_map(
			static fn( $s ) => wp_strip_all_tags( (string) $s ),
			(array) ( $pkg['excludes'] ?? array() )
		)
	);

	$intro = $pkg['itineraryIntro'] ?? sprintf( 'A %d-day journey: %s.', $days, $title );

	return array(
		'trip_code'                  => "WTE-{$trip_id}",
		'overview_section_title'     => $title,
		'tab_content'                => array( '1_wpeditor' => ams_build_overview( $pkg ) ),
		'trip_duration'              => $days,
		'trip_duration_unit'         => 'days',
		'trip_duration_nights'       => max( 0, $days - 1 ),
		'trip_highlights_title'      => 'Trip Highlights',
		'trip_highlights'            => $highlights,
		'trip_itinerary_title'       => 'Day-by-Day Itinerary',
		'trip_itinerary_description' => ams_paragraph_block( (string) $intro ),
		'itinerary'                  => $itinerary,
		'cost_tab_sec_title'         => 'Inclusions & Exclusions',
		'cost'                       => array(
			'includes_title'  => 'Inclusions',
			'cost_includes'   => $includes_list ? implode( "\n\n", $includes_list ) : ams_default_includes(),
			'excludes_title'  => 'What is Excluded',
			'cost_excludes'   => $excludes_list ? implode( "\n\n", $excludes_list ) : ams_default_excludes(),
		),
	);
}

function ams_sync_trip_settings( int $trip_id, array $pkg ): void {
	$existing = get_post_meta( $trip_id, 'wp_travel_engine_setting', true );
	if ( ! is_array( $existing ) ) {
		$existing = array();
	}
	$built    = ams_build_wte_settings( $pkg, $trip_id );
	$settings = array_merge( $existing, $built );
	if ( isset( $built['cost'] ) ) {
		$settings['cost'] = array_merge( $existing['cost'] ?? array(), $built['cost'] );
	}
	if ( isset( $built['itinerary'] ) ) {
		$settings['itinerary'] = $built['itinerary'];
	}
	if ( isset( $built['tab_content'] ) ) {
		$settings['tab_content'] = array_merge( $existing['tab_content'] ?? array(), $built['tab_content'] );
	}
	update_post_meta( $trip_id, 'wp_travel_engine_setting', $settings );
}

// ---------------------------------------------------------------------------
// Import loop
// ---------------------------------------------------------------------------
$adult_cat_id = (int) ( wptravelengine_settings()->get_primary_pricing_category()->term_id ?? 9 );
$created     = 0;
$updated     = 0;
$skipped     = 0;
$failed      = 0;

echo ( $dry_run ? '[DRY RUN] ' : '' ) . 'Importing ' . count( $packages ) . " packages into WP Travel Engine…\n";

foreach ( $packages as $pkg ) {
	$source = $pkg['sourceUrl'] ?? '';
	$title  = $pkg['name'] ?? 'Safari';
	$slug   = preg_replace( '/^ams-(?:beach-|safari-)?[^-]+-/', '', $pkg['slug'] ?? '' );
	$slug   = sanitize_title( $slug ?: $title );

	$existing = ams_trip_exists( $source );
	if ( $existing ) {
		if ( ! $dry_run ) {
			$days  = max( 1, (int) ( $pkg['days'] ?? 1 ) );
			$hours = $days * 24;
			$usd   = (int) ( $pkg['priceN'] ?? 0 );
			$price = $usd > 0 ? (int) round( $usd * $usd_to_kes ) : 0;

			wp_update_post(
				array(
					'ID'           => $existing,
					'post_title'   => $title,
					'post_excerpt' => wp_strip_all_tags( $pkg['blurb'] ?? '' ),
				)
			);
			update_post_meta( $existing, '_s_price', $price );
			update_post_meta( $existing, '_s_duration', $hours );
			update_post_meta( $existing, 'wp_travel_engine_setting_trip_price', $price );
			update_post_meta( $existing, 'wp_travel_engine_setting_trip_duration', $hours );
			update_post_meta( $existing, '_sf_tag', (string) ( $pkg['tag'] ?? 'Safari' ) );
			ams_sync_trip_settings( $existing, $pkg );

			$exp = $pkg['exps'][0] ?? 'Wildlife safari';
			$act_slug = $activity_map[ $exp ] ?? 'wildlife-safari';
			$act_id   = ams_ensure_term( 'activities', $act_slug, $exp );
			if ( $act_id ) {
				wp_set_object_terms( $existing, array( (int) $act_id ), 'activities', false );
			}

			$dest_name = $pkg['dest'] ?? $pkg['region'] ?? 'Kenya';
			$dest_slug = $dest_map[ $dest_name ] ?? sanitize_title( $dest_name );
			$dest_id   = ams_ensure_term( 'destination', $dest_slug, $dest_name );
			if ( $dest_id ) {
				wp_set_object_terms( $existing, array( (int) $dest_id ), 'destination', false );
			}

			if ( ! empty( $pkg['image'] ) ) {
				$img_id = ams_sideload_image( $pkg['image'], $existing, $title );
				if ( $img_id ) {
					set_post_thumbnail( $existing, $img_id );
				}
			}
		}
		echo "  UPDATED #{$existing}: {$title}\n";
		++$updated;
		continue;
	}

	if ( $dry_run ) {
		echo "  WOULD CREATE: {$title} → /trip/{$slug}/\n";
		++$created;
		continue;
	}

	// 1. Create trip (same post type as your existing trip).
	$trip = Trip::create( $title, 'publish' );
	if ( ! $trip ) {
		echo "  FAIL: {$title}\n";
		++$failed;
		continue;
	}

	$trip_id = $trip->ID;

	// Trip::create() adds the ID to wptravelengine_custom_trips (hidden from catalog) — remove it.
	$custom_trips = get_option( 'wptravelengine_custom_trips', array() );
	if ( is_array( $custom_trips ) ) {
		$custom_trips = array_values( array_diff( array_map( 'intval', $custom_trips ), array( $trip_id ) ) );
		update_option( 'wptravelengine_custom_trips', $custom_trips );
	}
	delete_post_meta( $trip_id, 'is_created_from_booking' );
	wp_update_post(
		array(
			'ID'          => $trip_id,
			'post_author' => 1,
		)
	);

	// 2. Slug + excerpt.
	wp_update_post(
		array(
			'ID'          => $trip_id,
			'post_name'   => $slug,
			'post_excerpt'=> wp_strip_all_tags( $pkg['blurb'] ?? '' ),
		)
	);

	// 3. Duration (WTE stores hours) + price in store currency.
	$days     = max( 1, (int) ( $pkg['days'] ?? 1 ) );
	$hours    = $days * 24;
	$usd      = (int) ( $pkg['priceN'] ?? 0 );
	$price    = $usd > 0 ? (int) round( $usd * $usd_to_kes ) : 0;

	// 4. Create pricing package (like trip #84's "Standard Premium Comfort" package).
	$package_id = $trip->create_manual_package(
		array(
			'name'        => 'Standard',
			'description' => '',
			'prices'      => array( $adult_cat_id => (string) $price ),
		)
	);

	if ( ! $package_id ) {
		echo "  FAIL package: {$title}\n";
		wp_delete_post( $trip_id, true );
		++$failed;
		continue;
	}

	// 5. Link package — required for /trip/{slug}/ booking widget + REST API.
	$trip->set_meta( 'packages_ids', array( $package_id ) );
	$trip->set_meta( 'primary_package', $package_id );
	$trip->set_meta( 'trip_version', '2.0.0' );
	$trip->set_meta( '_ams_source_url', $source );
	$trip->set_meta( '_ams_source_slug', $pkg['slug'] ?? '' );
	$trip->set_meta( '_sf_rating', (float) ( $pkg['rating'] ?? 4.8 ) );
	$trip->set_meta( '_sf_tag', (string) ( $pkg['tag'] ?? ( ( $pkg['category'] ?? '' ) === 'beach' ? 'Beach' : 'Safari' ) ) );

	// Legacy price/duration meta (used by sf-rest-fields + catalog).
	update_post_meta( $trip_id, '_s_price', $price );
	update_post_meta( $trip_id, '_s_duration', $hours );
	update_post_meta( $trip_id, 'wp_travel_engine_setting_trip_price', $price );
	update_post_meta( $trip_id, 'wp_travel_engine_setting_trip_duration', $hours );

	// 6. Trip settings tab content (overview, highlights, itinerary, inclusions).
	ams_sync_trip_settings( $trip_id, $pkg );

	$trip->save();

	// 7. Taxonomies: destination + activity.
	$dest_name = $pkg['dest'] ?? $pkg['region'] ?? 'Kenya';
	$dest_slug = $dest_map[ $dest_name ] ?? sanitize_title( $dest_name );
	$dest_id   = ams_ensure_term( 'destination', $dest_slug, $dest_name );
	if ( $dest_id ) {
		wp_set_object_terms( $trip_id, array( (int) $dest_id ), 'destination', false );
	}

	$exp = $pkg['exps'][0] ?? 'Wildlife safari';
	$act_slug = $activity_map[ $exp ] ?? 'wildlife-safari';
	$act_id   = ams_ensure_term( 'activities', $act_slug, $exp );
	if ( $act_id ) {
		wp_set_object_terms( $trip_id, array( (int) $act_id ), 'activities', false );
	}

	// 8. Featured image (best-effort).
	$img_id = ams_sideload_image( $pkg['image'] ?? '', $trip_id, $title );
	if ( $img_id ) {
		set_post_thumbnail( $trip_id, $img_id );
	}

	$permalink = get_permalink( $trip_id );
	echo "  OK #{$trip_id}: {$title}\n      → {$permalink}\n";
	++$created;
}

echo "\nDone. created={$created} updated={$updated} skipped={$skipped} failed={$failed}\n";
if ( ! $dry_run && $created > 0 ) {
	echo "View trips: " . admin_url( 'edit.php?post_type=trip' ) . "\n";
}
