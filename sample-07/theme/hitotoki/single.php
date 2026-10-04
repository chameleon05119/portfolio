<?php
/**
 * お知らせの記事
 */

defined( 'ABSPATH' ) || exit;

get_header();

while ( have_posts() ) :
	the_post();
	$hitotoki_cat  = hitotoki_post_category();
	// 一覧と同じ並び（新しい順）で「前」は古い記事、「次」は新しい記事
	$hitotoki_prev = get_previous_post();
	$hitotoki_next = get_next_post();
	?>
	<main id="main">
		<?php hitotoki_breadcrumb( array( array( 'お知らせ', hitotoki_news_url() ), array( get_the_title() ) ) ); ?>
		<article class="c-section c-section--tight p-article">
			<div class="l-container l-container--narrow">
				<p class="p-article__meta">
					<time datetime="<?php echo esc_attr( get_the_date( 'Y-m-d' ) ); ?>"><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></time>
					<?php if ( $hitotoki_cat ) : ?>
						<a class="c-category" href="<?php echo esc_url( get_category_link( $hitotoki_cat ) ); ?>"><?php echo esc_html( $hitotoki_cat->name ); ?></a>
					<?php endif; ?>
				</p>
				<h1><?php the_title(); ?></h1>
				<?php if ( has_post_thumbnail() ) : ?>
					<figure class="c-photo"><?php the_post_thumbnail( 'large', array( 'sizes' => '(min-width: 880px) 800px, 100vw', 'loading' => false, 'fetchpriority' => 'high' ) ); ?></figure>
				<?php endif; ?>
				<div class="p-article__body">
					<?php the_content(); ?>
				</div>
				<nav class="p-article__pager" aria-label="前後のお知らせ">
					<?php if ( $hitotoki_prev ) : ?>
						<a href="<?php echo esc_url( get_permalink( $hitotoki_prev ) ); ?>">‹ 前のお知らせ</a>
					<?php else : ?>
						<span></span>
					<?php endif; ?>
					<a class="c-button c-button--ghost c-button--back" href="<?php echo esc_url( hitotoki_news_url() ); ?>">一覧へ戻る</a>
					<?php if ( $hitotoki_next ) : ?>
						<a href="<?php echo esc_url( get_permalink( $hitotoki_next ) ); ?>">次のお知らせ ›</a>
					<?php else : ?>
						<span></span>
					<?php endif; ?>
				</nav>
			</div>
		</article>
	</main>
	<?php
endwhile;

get_footer();
