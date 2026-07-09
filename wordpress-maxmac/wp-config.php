<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the website, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_ENGINE', 'sqlite' );
define( 'DB_NAME', 'database_name_here' );

/** Database username */
define( 'DB_USER', 'username_here' );

/** Database password */
define( 'DB_PASSWORD', 'password_here' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'R_6Tt[et#xni<}ib)h>6,^NET<dfghd@|)0MhZl6J+i#_8uKb?f0OR_*jcWBF5wS' );
define( 'SECURE_AUTH_KEY',  'vN`x#SqMJ  wBai6>mUw%BA-8xE3?2e!.foho$o+08J$W;v+;BEn{ZN;djp4Vmzr' );
define( 'LOGGED_IN_KEY',    'HyEZlC:EEqv`V~&tZr@e!?UK%BDkXyp9+af+*dsGNxB,`).65RX8+eMNJ+uvbRIG' );
define( 'NONCE_KEY',        'yfH.i=Ajd=xTB][2h~=el8Csm;ef*mek=>23iY1+j~!FM->C}S vI:_#K_Q&(HJB' );
define( 'AUTH_SALT',        ';7p3-DHaUC~BSW=BAhmKYb~HOp:wP*XzNx,LA7(g^<8PBo*KYjyW^m!L4E#.v<=J' );
define( 'SECURE_AUTH_SALT', '11R=Vj7-XX$6s=J4&%^(}TwD6qLatIZhQ$8>vSf~cy5,/a4?dO(mN6>ldD{pX(]o' );
define( 'LOGGED_IN_SALT',   'G3`DV*FWlq2Gg|3WT@>{5]v)@H9_6O^a-l {!#@]{q?zwxnOBD3i[X`zoa!+p|t&' );
define( 'NONCE_SALT',       '<&g>j5+I93Iha$h^`.4xV;Qt,O^m{UFSX;4vT:42RcG$d|w$dsDH6*JoOThj$6VB' );

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 *
 * At the installation time, database tables are created with the specified prefix.
 * Changing this value after WordPress is installed will make your site think
 * it has not been installed.
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/#table-prefix
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://developer.wordpress.org/advanced-administration/debug/debug-wordpress/
 */
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */

// Astro frontend origin — used by sf-checkout-api.php for CORS and post-payment redirects.
// Override via environment variable in production.
if ( ! defined( 'SF_FRONTEND_ORIGIN' ) ) {
	$sf_frontend_origin = getenv( 'SF_FRONTEND_ORIGIN' );
	define( 'SF_FRONTEND_ORIGIN', $sf_frontend_origin ? $sf_frontend_origin : 'http://localhost:4321' );
}

// Local dev: the single-threaded `php -S` server deadlocks on WP's loopback
// cron request. Disable the loopback; run cron manually if needed:
//   php wp-cron.php
define( 'DISABLE_WP_CRON', true );



/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';

set_time_limit(300);
