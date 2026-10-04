<?php
/**
 * 共通ヘッダー（<head>・ヘッダー・スマホメニュー）
 */

defined( 'ABSPATH' ) || exit;

$hitotoki_nav = hitotoki_nav_items( 'global' );
$hitotoki_ig  = hitotoki_shop( 'instagram' );
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="u-skip" href="#main">本文へ移動</a>
<header class="l-header">
	<div class="l-header__inner">
		<?php hitotoki_logo(); ?>
		<nav class="l-header__nav" aria-label="グローバル">
			<?php foreach ( $hitotoki_nav as $item ) : ?>
				<a href="<?php echo esc_url( $item['url'] ); ?>"<?php echo hitotoki_nav_current( $item['url'] ); // phpcs:ignore WordPress.Security.EscapeOutput -- 固定の属性文字列 ?>><?php echo esc_html( $item['label'] ); ?></a>
			<?php endforeach; ?>
		</nav>
		<?php if ( $hitotoki_ig ) : ?>
			<a class="c-ig l-header__ig" href="<?php echo esc_url( $hitotoki_ig ); ?>" target="_blank" rel="noopener" aria-label="Instagram（新しいタブで開く）"><?php echo hitotoki_ig_icon(); // phpcs:ignore WordPress.Security.EscapeOutput ?></a>
		<?php endif; ?>
		<button class="l-header__menu" type="button" aria-expanded="false" aria-controls="drawer" aria-label="メニューを開く"><span></span></button>
	</div>
</header>
<nav class="l-drawer" id="drawer" aria-label="メニュー" hidden>
	<ul>
		<li><a href="<?php echo esc_url( home_url( '/' ) ); ?>"<?php echo hitotoki_nav_current( home_url( '/' ) ); // phpcs:ignore WordPress.Security.EscapeOutput ?>>トップ<span aria-hidden="true">Top</span></a></li>
		<?php foreach ( $hitotoki_nav as $item ) : ?>
			<li><a href="<?php echo esc_url( $item['url'] ); ?>"<?php echo hitotoki_nav_current( $item['url'] ); // phpcs:ignore WordPress.Security.EscapeOutput ?>><?php echo esc_html( $item['label'] ); ?><?php if ( $item['en'] ) : ?><span aria-hidden="true"><?php echo esc_html( $item['en'] ); ?></span><?php endif; ?></a></li>
		<?php endforeach; ?>
	</ul>
	<p class="l-drawer__info">
		営業時間 <?php echo esc_html( hitotoki_hours_label() ); ?>（L.O. <?php echo esc_html( hitotoki_time_label( hitotoki_shop( 'last_order' ) ) ); ?>）<br />
		定休日 <?php echo esc_html( hitotoki_closed_label() ); ?><br />
		<?php echo esc_html( hitotoki_shop( 'access' ) ); ?>
	</p>
	<?php if ( $hitotoki_ig ) : ?>
		<a class="c-ig" href="<?php echo esc_url( $hitotoki_ig ); ?>" target="_blank" rel="noopener" aria-label="Instagram（新しいタブで開く）"><?php echo hitotoki_ig_icon(); // phpcs:ignore WordPress.Security.EscapeOutput ?></a>
	<?php endif; ?>
</nav>
