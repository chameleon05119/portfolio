<?php
/**
 * メニューページ（/menu/）
 * 管理画面「メニュー」の品目を、分類（並び順どおり）ごとに出す。写真は分類の左右に交互に置く
 */

defined( 'ABSPATH' ) || exit;

get_header();

global $wp_query;
$hitotoki_sections = hitotoki_menu_sections( $wp_query->posts );
?>
<main id="main">
	<?php hitotoki_breadcrumb( array( array( 'メニュー' ) ) ); ?>
	<?php hitotoki_page_head( 'メニュー', 'Menu', '価格はすべて税込です' ); ?>

	<?php if ( $hitotoki_sections ) : ?>
		<nav class="p-menu-nav" aria-label="メニューの分類">
			<ul>
				<?php foreach ( $hitotoki_sections as $section ) : ?>
					<li><a href="#<?php echo esc_attr( hitotoki_menu_anchor( $section['term'] ) ); ?>"><?php echo esc_html( $section['term']->name ); ?></a></li>
				<?php endforeach; ?>
			</ul>
		</nav>

		<?php
		foreach ( $hitotoki_sections as $i => $section ) :
			$term  = $section['term'];
			$meta  = $section['meta'];
			$id    = hitotoki_menu_anchor( $term );
			$class = 'p-menu-section' . ( $i % 2 ? ' p-menu-section--reverse' : '' );
			?>
			<section class="<?php echo esc_attr( $class ); ?>" id="<?php echo esc_attr( $id ); ?>" aria-labelledby="<?php echo esc_attr( $id ); ?>-title">
				<div class="l-container p-menu-section__inner">
					<div class="u-reveal">
						<div class="c-heading">
							<?php if ( $meta['en'] ) : ?>
								<span class="c-heading__en" aria-hidden="true"><?php echo esc_html( $meta['en'] ); ?></span>
							<?php endif; ?>
							<h2 id="<?php echo esc_attr( $id ); ?>-title"><?php echo esc_html( $term->name ); ?></h2>
						</div>
						<ul class="p-menu-list">
							<?php
							foreach ( $section['items'] as $item ) :
								$m = hitotoki_menu_meta( $item->ID );
								?>
								<li>
									<?php
									// 品名・マーク・ひとことは空白を挟まずにつなげる（間に改行があると表示に余分な空きが出る）
									$name = esc_html( get_the_title( $item ) );
									foreach ( $m['marks'] as $mark ) {
										if ( isset( HITOTOKI_MENU_MARKS[ $mark ] ) ) {
											$name .= '<span class="c-mark">' . esc_html( HITOTOKI_MENU_MARKS[ $mark ] ) . '</span>';
										}
									}
									if ( $m['desc'] ) {
										$name .= '<small>' . esc_html( $m['desc'] ) . '</small>';
									}
									?>
									<span class="p-menu-list__name"><?php echo $name; // phpcs:ignore WordPress.Security.EscapeOutput -- 部品ごとにエスケープ済み ?></span>
									<span class="p-menu-list__dots" aria-hidden="true"></span>
									<span class="p-menu-list__price"><?php echo esc_html( hitotoki_price_label( $item->ID ) ); ?></span>
								</li>
							<?php endforeach; ?>
						</ul>
						<?php if ( $meta['note'] ) : ?>
							<p class="p-menu-section__note"><?php echo esc_html( $meta['note'] ); ?></p>
						<?php endif; ?>
					</div>
					<?php if ( $meta['image'] ) : ?>
						<div class="c-photo p-menu-section__photo u-reveal"><?php echo wp_get_attachment_image( $meta['image'], 'medium_large', false, array( 'sizes' => '(min-width: 768px) 45vw, 100vw' ) ); ?></div>
					<?php endif; ?>
				</div>
			</section>
		<?php endforeach; ?>
	<?php else : ?>
		<div class="c-section c-section--tight"><div class="l-container l-container--narrow"><p>メニューは準備中です。</p></div></div>
	<?php endif; ?>

	<section class="c-section c-section--flush" aria-labelledby="guide-title">
		<div class="l-container l-container--narrow">
			<div class="p-menu-guide u-reveal">
				<h2 id="guide-title">ご注文について</h2>
				<ul>
					<li>アレルギーのある方は、ご注文の前にスタッフへお声がけください。</li>
					<li>焼き菓子のまとめての注文（6個以上）は、前日までにお電話でご予約ください。</li>
					<li>メニューと価格は、季節によって変わることがあります。</li>
				</ul>
			</div>
		</div>
	</section>
</main>
<?php
get_footer();
