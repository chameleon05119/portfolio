<?php
/**
 * ページが見つからないとき
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="main">
	<?php hitotoki_breadcrumb( array( array( 'ページが見つかりません' ) ) ); ?>
	<?php hitotoki_page_head( 'ページが見つかりません', 'Not found' ); ?>
	<div class="c-section c-section--tight">
		<div class="l-container l-container--narrow">
			<p>お探しのページは、移動または削除された可能性があります。</p>
			<p class="p-more"><a class="c-button" href="<?php echo esc_url( home_url( '/' ) ); ?>">トップへ戻る</a></p>
		</div>
	</div>
</main>
<?php
get_footer();
