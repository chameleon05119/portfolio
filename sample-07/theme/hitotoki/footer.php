<?php
/**
 * 共通フッター
 */

defined( 'ABSPATH' ) || exit;

$hitotoki_ig = hitotoki_shop( 'instagram' );
$hitotoki_tel = hitotoki_shop( 'tel' );
?>
<footer class="l-footer">
	<div class="l-container">
		<?php hitotoki_logo(); ?>
		<address>〒<?php echo esc_html( hitotoki_shop( 'postal' ) ); ?> <?php echo esc_html( hitotoki_shop( 'address' ) ); ?><br />TEL <a href="tel:<?php echo esc_attr( preg_replace( '/\D/', '', $hitotoki_tel ) ); ?>"><?php echo esc_html( $hitotoki_tel ); ?></a></address>
		<p class="l-footer__hours"><?php echo esc_html( hitotoki_hours_label() ); ?>（<?php echo esc_html( hitotoki_closed_label() ); ?> 定休）</p>
		<nav class="l-footer__nav" aria-label="フッター">
			<?php foreach ( hitotoki_nav_items( 'footer' ) as $item ) : ?>
				<a href="<?php echo esc_url( $item['url'] ); ?>"><?php echo esc_html( $item['label'] ); ?></a>
			<?php endforeach; ?>
			<?php if ( $hitotoki_ig ) : ?>
				<a href="<?php echo esc_url( $hitotoki_ig ); ?>" target="_blank" rel="noopener">Instagram<?php echo hitotoki_new_tab_note(); // phpcs:ignore WordPress.Security.EscapeOutput ?></a>
			<?php endif; ?>
		</nav>
		<p class="l-footer__copy"><small>&copy; <?php echo esc_html( wp_date( 'Y' ) ); ?> Hitotoki Coffee</small><span>※ 架空のお店のデモサイトです（写真: Pexels）</span><?php // 実際のお店に使うときは、この 1 行の店名・注記を書き換える ?></p>
	</div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
