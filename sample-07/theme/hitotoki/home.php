<?php
/**
 * お知らせ一覧（設定 > 表示設定 の「投稿ページ」）。カテゴリ別の一覧（category.php）もこのテンプレートを使う
 * 絞り込みはカテゴリ別の一覧ページへのリンク（JS なしで動き、URL を共有できる）
 */

defined( 'ABSPATH' ) || exit;

get_header();

$hitotoki_cat     = is_category() ? get_queried_object() : null;
$hitotoki_news    = hitotoki_news_url();
$hitotoki_cats    = get_categories(
	array(
		'exclude'    => array( (int) get_option( 'default_category' ) ),
		'hide_empty' => true,
		'orderby'    => 'term_id', // 作った順（名前順だと「お店」が先頭になる）
	)
);
?>
<main id="main">
	<?php
	hitotoki_breadcrumb(
		$hitotoki_cat
			? array( array( 'お知らせ', $hitotoki_news ), array( $hitotoki_cat->name ) )
			: array( array( 'お知らせ' ) )
	);
	hitotoki_page_head( $hitotoki_cat ? 'お知らせ：' . $hitotoki_cat->name : 'お知らせ', 'News' );
	?>
	<section class="c-section c-section--tight" aria-label="お知らせ一覧">
		<div class="l-container l-container--narrow">
			<?php if ( $hitotoki_cats ) : ?>
				<nav class="p-news-filter" aria-label="カテゴリで絞り込み">
					<a href="<?php echo esc_url( $hitotoki_news ); ?>"<?php echo $hitotoki_cat ? '' : ' aria-current="page"'; ?>>すべて</a>
					<?php foreach ( $hitotoki_cats as $cat ) : ?>
						<a href="<?php echo esc_url( get_category_link( $cat ) ); ?>"<?php echo $hitotoki_cat && $hitotoki_cat->term_id === $cat->term_id ? ' aria-current="page"' : ''; ?>><?php echo esc_html( $cat->name ); ?></a>
					<?php endforeach; ?>
				</nav>
			<?php endif; ?>

			<?php if ( have_posts() ) : ?>
				<ul class="c-news-list">
					<?php
					while ( have_posts() ) {
						the_post();
						hitotoki_news_item();
					}
					?>
				</ul>
				<?php
				the_posts_pagination(
					array(
						'mid_size'           => 1,
						'prev_text'          => '‹ 新しいお知らせ',
						'next_text'          => '古いお知らせ ›',
						'screen_reader_text' => 'お知らせのページ送り',
						'aria_label'         => 'お知らせのページ送り',
						'class'              => 'c-pagination',
					)
				);
				?>
			<?php else : ?>
				<p>お知らせはまだありません。</p>
			<?php endif; ?>
		</div>
	</section>
</main>
<?php
get_footer();
