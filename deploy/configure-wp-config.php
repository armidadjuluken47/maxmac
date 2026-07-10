#!/usr/bin/env php
<?php
/**
 * Patch wordpress-maxmac/wp-config.php for production MySQL + SF_FRONTEND_ORIGIN.
 *
 * Usage:
 *   MYSQL_DB=maxmac_wp MYSQL_USER=maxmac MYSQL_PASSWORD=secret \
 *   FRONTEND_ORIGIN=https://maxmacsafaris.com \
 *   php deploy/configure-wp-config.php /path/to/wp-config.php
 */
if ( PHP_SAPI !== 'cli' ) {
	exit( 'CLI only.' );
}

$config = $argv[1] ?? '';
$db_name = getenv( 'MYSQL_DB' ) ?: '';
$db_user = getenv( 'MYSQL_USER' ) ?: '';
$db_pass = getenv( 'MYSQL_PASSWORD' ) ?: '';
$db_host = getenv( 'MYSQL_HOST' ) ?: 'localhost';
$origin  = rtrim( (string) ( getenv( 'FRONTEND_ORIGIN' ) ?: '' ), '/' );

foreach ( array( 'MYSQL_DB' => $db_name, 'MYSQL_USER' => $db_user, 'MYSQL_PASSWORD' => $db_pass, 'FRONTEND_ORIGIN' => $origin ) as $label => $val ) {
	if ( $val === '' ) {
		fwrite( STDERR, "Missing env: {$label}\n" );
		exit( 1 );
	}
}

if ( ! $config || ! is_file( $config ) ) {
	fwrite( STDERR, "Usage: MYSQL_DB=... MYSQL_USER=... MYSQL_PASSWORD=... FRONTEND_ORIGIN=... php configure-wp-config.php /path/to/wp-config.php\n" );
	exit( 1 );
}

$content = file_get_contents( $config );
if ( $content === false ) {
	fwrite( STDERR, "Could not read {$config}\n" );
	exit( 1 );
}

$content = preg_replace( "/define\s*\(\s*'DB_ENGINE'\s*,\s*'sqlite'\s*\)\s*;\s*\n?/", '', $content );

$replace_define = static function ( string $name, string $value ) use ( &$content ): void {
	$exported = var_export( $value, true );
	$pattern  = "/define\s*\(\s*'{$name}'\s*,\s*'[^']*'\s*\)\s*;/";
	$replacement = "define( '{$name}', {$exported} );";
	if ( preg_match( $pattern, $content ) ) {
		$content = preg_replace( $pattern, $replacement, $content, 1 );
	} else {
		fwrite( STDERR, "Could not find define('{$name}') in wp-config.php\n" );
		exit( 1 );
	}
};

$replace_define( 'DB_NAME', $db_name );
$replace_define( 'DB_USER', $db_user );
$replace_define( 'DB_PASSWORD', $db_pass );
$replace_define( 'DB_HOST', $db_host );

$origin_block = "define( 'SF_FRONTEND_ORIGIN', " . var_export( $origin, true ) . " );";
$content      = preg_replace(
	"/\\/\\/ Astro frontend origin[\\s\\S]*?define\\s*\\(\\s*'DISABLE_WP_CRON'\\s*,\\s*true\\s*\\)\\s*;/",
	"// Astro frontend origin — set by deploy/configure-wp-config.php\n{$origin_block}\n\n// Use system cron on the server (deploy/setup.sh adds crontab entry).\ndefine( 'DISABLE_WP_CRON', true );",
	$content,
	1
);

if ( ! str_contains( $content, "define( 'SF_FRONTEND_ORIGIN'" ) ) {
	fwrite( STDERR, "Failed to set SF_FRONTEND_ORIGIN in wp-config.php\n" );
	exit( 1 );
}

$backup = $config . '.bak.' . gmdate( 'Ymd-His' );
if ( ! copy( $config, $backup ) ) {
	fwrite( STDERR, "Could not write backup {$backup}\n" );
	exit( 1 );
}

if ( file_put_contents( $config, $content ) === false ) {
	fwrite( STDERR, "Could not write {$config}\n" );
	exit( 1 );
}

echo "OK: configured {$config}\n";
echo "    backup: {$backup}\n";
echo "    database: {$db_name} @ {$db_host}\n";
echo "    SF_FRONTEND_ORIGIN: {$origin}\n";

// Disable SQLite drop-in (local dev only). Production uses MySQL.
$wp_content = dirname( $config ) . '/wp-content';
$dropin     = $wp_content . '/db.php';
$disabled   = $wp_content . '/db.php.sqlite-local-dev';
if ( is_file( $dropin ) ) {
	if ( rename( $dropin, $disabled ) ) {
		echo "    sqlite drop-in: disabled (renamed to db.php.sqlite-local-dev)\n";
	} else {
		fwrite( STDERR, "Warning: could not rename {$dropin} — remove it manually for MySQL\n" );
	}
}
