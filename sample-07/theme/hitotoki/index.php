<?php
/**
 * どのテンプレートにも当たらないときの表示（検索結果・日付別の一覧など）
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="main">
	<?php hitotoki_breadcrumb( array( array( wp_strip_all_tags( get_the_archive_title() ) ?: 'お知らせ' ) ) ); ?>
	<?php hitotoki_page_head( is_search() ? '「' . get_search_query() . '」の検索結果' : ( wp_strip_all_tags( get_the_archive_title() ) ?: 'お知らせ' ), 'News' ); ?>
	<section class="c-section c-section--tight">
		<div class="l-container l-container--narrow">
			<?php if ( have_posts() ) : ?>
				<ul class="c-news-list">
					<?php
					while ( have_posts() ) {
						the_post();
						hitotoki_news_item();
					}
					?>
				</ul>
				<?php the_posts_pagination( array( 'class' => 'c-pagination' ) ); ?>
			<?php else : ?>
				<p>該当するページは見つかりませんでした。</p>
			<?php endif; ?>
		</div>
	</section>
</main>
<?php
get_footer();
