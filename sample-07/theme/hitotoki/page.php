<?php
/**
 * 固定ページ（プライバシーポリシーなど、管理画面で追加したページ）
 */

defined( 'ABSPATH' ) || exit;

get_header();

while ( have_posts() ) :
	the_post();
	?>
	<main id="main">
		<?php hitotoki_breadcrumb( array( array( get_the_title() ) ) ); ?>
		<?php hitotoki_page_head( get_the_title(), ucfirst( str_replace( '-', ' ', urldecode( get_post_field( 'post_name' ) ) ) ) ); ?>
		<div class="c-section c-section--tight">
			<div class="l-container l-container--narrow p-article__body">
				<?php the_content(); ?>
			</div>
		</div>
	</main>
	<?php
endwhile;

get_footer();
