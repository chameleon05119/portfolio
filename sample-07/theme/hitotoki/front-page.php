<?php
/**
 * トップページ
 *
 * 写真と文章は固定（お店の紹介は頻繁に変わらないため）。
 * 「本日の営業」・メニュー・お知らせ・アクセスは管理画面の内容を表示する
 */

defined( 'ABSPATH' ) || exit;

get_header();

$hitotoki_latest = get_posts( array( 'numberposts' => 3 ) );
$hitotoki_menu   = get_posts(
	array(
		'post_type'   => HITOTOKI_MENU,
		'numberposts' => 3,
		'meta_key'    => '_hitotoki_featured', // phpcs:ignore WordPress.DB.SlowDBQuery -- 品目は数十件なので問題ない
		'meta_value'  => '1', // phpcs:ignore WordPress.DB.SlowDBQuery
		'orderby'     => array( 'menu_order' => 'ASC', 'title' => 'ASC' ),
	)
);
$hitotoki_ig     = hitotoki_shop( 'instagram' );
$hitotoki_tel    = hitotoki_shop( 'tel' );
?>
<main id="main">
	<section class="p-fv" aria-label="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">
		<div class="p-fv__copy">
			<h1><span>ひと息、</span><br /><span>つきにおいで。</span></h1>
			<p>住宅街の小さな喫茶店。<br />一杯ずつ淹れるコーヒーと、<br />自家製の焼き菓子。</p>
		</div>
		<div class="p-fv__visual">
			<div class="p-fv__photo">
				<?php
				echo hitotoki_img( // phpcs:ignore WordPress.Security.EscapeOutput -- 関数内でエスケープ済み
					'mv',
					array( 750, 1200, 1800 ),
					array(
						'src'           => HITOTOKI_URI . '/assets/images/mv-1200w.webp',
						'sizes'         => '(min-width: 1024px) 65vw, 100vw',
						'width'         => 1800,
						'height'        => 1196,
						'alt'           => '窓からの光が差し込む木のテーブルに、湯気の立つコーヒーカップ',
						'loading'       => false,
						'decoding'      => false,
						'fetchpriority' => 'high',
					)
				);
				?>
				<svg class="p-steam" viewBox="0 0 120 200" aria-hidden="true">
					<path d="M45 190c-18-30 22-48 4-80s18-50 6-90" />
					<path d="M65 190c-16-28 20-46 2-78s16-52 8-92" />
					<path d="M80 190c-14-26 16-44 0-74s12-48 6-86" />
				</svg>
			</div>
			<div class="p-today">
				<p>
					<!-- JS で「本日 定休日」「営業時間外」などに切り替える（判定に使う営業日は「お店の情報」の設定） -->
					<span class="p-today__status" data-today-status>営業時間</span>
					<span class="p-today__hours"><?php echo esc_html( hitotoki_hours_label() ); ?></span>
				</p>
				<?php if ( $hitotoki_latest ) : ?>
					<p class="p-today__news">お知らせ<a href="<?php echo esc_url( get_permalink( $hitotoki_latest[0] ) ); ?>"><?php echo esc_html( get_the_title( $hitotoki_latest[0] ) ); ?></a></p>
				<?php endif; ?>
			</div>
		</div>
	</section>

	<section class="c-section c-section--tight" id="about">
		<div class="l-container p-about">
			<div class="c-photo p-about__photo u-reveal">
				<?php echo hitotoki_img( 'about-room', array( 600, 1200 ), array( 'sizes' => '(min-width: 768px) 45vw, 100vw', 'width' => 1200, 'height' => 800, 'alt' => '木の椅子とテーブルが並ぶ、自然光の入る店内' ) ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</div>
			<div class="p-about__text u-reveal">
				<div class="c-heading c-heading--flush"><span class="c-heading__en" aria-hidden="true">About</span><h2>コーヒーの香りと、<br />少しの休憩を。</h2></div>
				<p>家と仕事のあいだにある、小さな休憩所のような店でありたいと思っています。</p>
				<p>コーヒーは注文をいただいてから、一杯ずつハンドドリップで。お湯を注ぐと、店の中にふわっと香りが広がります。淹れ上がるまでの数分も、どうぞゆっくり。</p>
				<div class="c-photo p-about__sub">
					<?php echo hitotoki_img( 'about-drip', array( 500, 900 ), array( 'sizes' => '(min-width: 768px) 28vw, 62vw', 'width' => 1000, 'height' => 666, 'alt' => 'ドリッパーにお湯を注ぎ、コーヒーの粉がふくらむ様子' ) ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				</div>
			</div>
		</div>
	</section>

	<section class="c-section c-section--sub" id="scenes">
		<div class="l-container">
			<div class="c-heading c-heading--center u-reveal"><span class="c-heading__en" aria-hidden="true">How to spend</span><h2>ひとときの過ごし方</h2></div>
			<ul class="p-scenes" tabindex="0" aria-label="ひとときの過ごし方（スマホでは横にスクロール）">
				<?php
				$hitotoki_scenes = array(
					array( 'scene-morning', 598, '窓辺に置かれた温かいカフェオレ', 'Morning 8:00 –', '朝の一杯で、目を覚ます', '厚切りトーストのモーニングと一緒に。出勤前のテイクアウトもどうぞ。' ),
					array( 'scene-afternoon', 600, 'カフェラテと焼き菓子', 'Afternoon 13:00 –', '昼下がりは、焼き菓子と', '午後に焼き上がるスコーンを、温かいうちに。友人とのおしゃべりにも。' ),
					array( 'scene-evening', 1347, '窓辺で開いた本と、ラテアートのカップ', 'Evening 16:00 –', '夕方は、本を一冊', '本棚の本はご自由に。ひとりで静かに過ごす時間も、この店の役目です。' ),
				);
				foreach ( $hitotoki_scenes as [ $img, $h, $alt, $time, $title, $text ] ) :
					?>
					<li class="u-reveal">
						<div class="c-photo p-scenes__photo"><?php echo hitotoki_img( $img, array( 500, 900 ), array( 'sizes' => '(min-width: 768px) 30vw, 80vw', 'width' => 900, 'height' => $h, 'alt' => $alt ) ); // phpcs:ignore WordPress.Security.EscapeOutput ?></div>
						<span class="p-scenes__time" aria-hidden="true"><?php echo esc_html( $time ); ?></span>
						<h3><?php echo esc_html( $title ); ?></h3>
						<p><?php echo esc_html( $text ); ?></p>
					</li>
				<?php endforeach; ?>
			</ul>
			<p class="p-scroll-hint" aria-hidden="true">← 横にスワイプ →</p>
		</div>
	</section>

	<section class="c-section" id="space">
		<div class="l-container">
			<div class="c-heading u-reveal"><span class="c-heading__en" aria-hidden="true">Space</span><h2>店内のこと</h2></div>
			<div class="p-space u-reveal" data-lightbox>
				<?php
				$hitotoki_space = array(
					array( 'space-main', array( 600, 1200 ), '(min-width: 768px) 50vw, 100vw', 1400, 787, '植物に囲まれた明るい店内', '店内' ),
					array( 'space-counter', array( 500, 800 ), '(min-width: 768px) 25vw, 50vw', 800, 533, 'コーヒーを淹れるカウンター', 'カウンター' ),
					array( 'space-window', array( 500, 800 ), '(min-width: 768px) 25vw, 50vw', 800, 533, '大きな窓に面したテーブル席', '窓際の席' ),
					array( 'space-sofa', array( 500, 800 ), '(min-width: 768px) 25vw, 50vw', 800, 1200, '本棚の前のソファ席', 'ソファ席' ),
					array( 'space-books', array( 500, 800 ), '(min-width: 768px) 25vw, 50vw', 800, 1200, '自由に読める本が並ぶ本棚', '本棚' ),
				);
				foreach ( $hitotoki_space as [ $img, $widths, $sizes, $w, $h, $alt, $label ] ) :
					?>
					<button type="button" aria-label="<?php echo esc_attr( $label ); ?>の写真を拡大">
						<span class="c-photo"><?php echo hitotoki_img( $img, $widths, array( 'src' => HITOTOKI_URI . "/assets/images/{$img}-{$widths[0]}w.webp", 'sizes' => $sizes, 'width' => $w, 'height' => $h, 'alt' => $alt ) ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span>
						<span class="p-space__label" aria-hidden="true"><?php echo esc_html( $label ); ?></span>
					</button>
				<?php endforeach; ?>
			</div>
			<ul class="p-features u-reveal" aria-label="席と設備">
				<li>全20席（カウンター6・テーブル10・ソファ4）</li>
				<li>全席禁煙</li>
				<li>Wi-Fi</li>
				<li>電源（カウンター席）</li>
				<li>ベビーカーのまま入店OK</li>
				<li>おひとりさま歓迎</li>
			</ul>
		</div>
	</section>

	<?php if ( $hitotoki_menu ) : ?>
		<section class="c-section c-section--flush" id="menu">
			<div class="l-container">
				<div class="c-heading c-heading--center u-reveal"><span class="c-heading__en" aria-hidden="true">Menu</span><h2>メニュー</h2></div>
				<ul class="p-menu-cards">
					<?php
					foreach ( $hitotoki_menu as $hitotoki_item ) :
						$hitotoki_terms = get_the_terms( $hitotoki_item, HITOTOKI_MENU_CAT );
						$hitotoki_hash  = $hitotoki_terms && ! is_wp_error( $hitotoki_terms ) ? '#' . hitotoki_menu_anchor( $hitotoki_terms[0] ) : '';
						$hitotoki_meta  = hitotoki_menu_meta( $hitotoki_item->ID );
						?>
						<li class="u-reveal">
							<a href="<?php echo esc_url( get_post_type_archive_link( HITOTOKI_MENU ) . $hitotoki_hash ); ?>">
								<div class="c-photo"><?php echo get_the_post_thumbnail( $hitotoki_item, 'medium_large', array( 'sizes' => '(min-width: 768px) 30vw, 100vw', 'alt' => '' ) ); ?></div>
								<div class="p-menu-cards__body">
									<h3><?php echo esc_html( get_the_title( $hitotoki_item ) ); ?></h3>
									<?php if ( $hitotoki_meta['desc'] ) : ?>
										<p><?php echo esc_html( $hitotoki_meta['desc'] ); ?></p>
									<?php endif; ?>
									<span class="p-menu-cards__price"><?php echo esc_html( hitotoki_price_label( $hitotoki_item->ID ) ); ?></span>
								</div>
							</a>
						</li>
					<?php endforeach; ?>
				</ul>
				<p class="p-more"><a class="c-button" href="<?php echo esc_url( get_post_type_archive_link( HITOTOKI_MENU ) ); ?>">メニューをすべて見る</a></p>
			</div>
		</section>
	<?php endif; ?>

	<?php if ( $hitotoki_latest ) : ?>
		<section class="c-section c-section--flush" id="news">
			<div class="l-container p-top-news">
				<div class="u-reveal">
					<div class="c-heading"><span class="c-heading__en" aria-hidden="true">News</span><h2>お知らせ</h2></div>
					<a class="c-button c-button--ghost" href="<?php echo esc_url( hitotoki_news_url() ); ?>">一覧へ</a>
				</div>
				<ul class="c-news-list u-reveal">
					<?php
					foreach ( $hitotoki_latest as $hitotoki_post ) {
						hitotoki_news_item( $hitotoki_post );
					}
					?>
				</ul>
			</div>
		</section>
	<?php endif; ?>

	<?php if ( $hitotoki_ig ) : ?>
		<section class="c-section c-section--flush" id="instagram">
			<div class="l-container">
				<div class="c-heading c-heading--center u-reveal"><span class="c-heading__en" aria-hidden="true">Instagram</span><h2>日々のこと</h2></div>
				<ul class="p-ig u-reveal">
					<?php
					$hitotoki_ig_posts = array(
						array( 'ig1', 250, 'ラテアートのカップ' ),
						array( 'ig2', 534, '窓際のテーブルとスコーン' ),
						array( 'ig3', 267, 'ドリップの道具とカップ' ),
						array( 'ig4', 600, 'お皿にのった焼き菓子' ),
						array( 'ig5', 267, '日差しの入る店先の席' ),
						array( 'ig6', 267, 'ドリップコーヒーとカップ' ),
					);
					foreach ( $hitotoki_ig_posts as [ $img, $h, $label ] ) :
						?>
						<li><a href="<?php echo esc_url( $hitotoki_ig ); ?>" target="_blank" rel="noopener" aria-label="Instagram の投稿：<?php echo esc_attr( $label ); ?>（新しいタブで開く）"><span class="c-photo"><?php echo hitotoki_img( $img, array( 400 ), array( 'width' => 400, 'height' => $h, 'alt' => '' ) ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span></a></li>
					<?php endforeach; ?>
				</ul>
				<p class="p-more"><a class="c-button c-button--ghost" href="<?php echo esc_url( $hitotoki_ig ); ?>" target="_blank" rel="noopener">Instagram を見る<?php echo hitotoki_new_tab_note(); // phpcs:ignore WordPress.Security.EscapeOutput ?></a></p>
			</div>
		</section>
	<?php endif; ?>

	<section class="c-section c-section--sub" id="access">
		<div class="l-container">
			<div class="c-heading c-heading--center u-reveal"><span class="c-heading__en" aria-hidden="true">Access</span><h2>お店の場所と営業時間</h2></div>
			<div class="p-info u-reveal">
				<div>
					<h3>Place</h3>
					<dl>
						<dt>住所</dt><dd>〒<?php echo esc_html( hitotoki_shop( 'postal' ) ); ?><br /><?php echo esc_html( hitotoki_shop( 'address' ) ); ?></dd>
						<dt>アクセス</dt><dd><?php echo esc_html( hitotoki_shop( 'access' ) ); ?></dd>
						<?php if ( hitotoki_shop( 'parking' ) ) : ?>
							<dt>駐車場</dt><dd><?php echo esc_html( hitotoki_shop( 'parking' ) ); ?></dd>
						<?php endif; ?>
					</dl>
				</div>
				<div>
					<h3>Open</h3>
					<dl>
						<dt>営業時間</dt><dd><?php echo esc_html( hitotoki_hours_label() ); ?><br />（L.O. <?php echo esc_html( hitotoki_time_label( hitotoki_shop( 'last_order' ) ) ); ?>）</dd>
						<dt>定休日</dt><dd><?php echo esc_html( hitotoki_closed_label() ); ?></dd>
					</dl>
					<div class="p-calendar" data-calendar></div>
				</div>
				<div>
					<h3>Guide</h3>
					<dl>
						<?php if ( hitotoki_shop( 'reservation' ) ) : ?>
							<dt>ご予約</dt><dd><?php echo esc_html( hitotoki_shop( 'reservation' ) ); ?></dd>
						<?php endif; ?>
						<?php if ( hitotoki_shop( 'payment' ) ) : ?>
							<dt>お支払い</dt><dd><?php echo esc_html( hitotoki_shop( 'payment' ) ); ?></dd>
						<?php endif; ?>
						<dt>お電話</dt><dd><a href="tel:<?php echo esc_attr( preg_replace( '/\D/', '', $hitotoki_tel ) ); ?>"><?php echo esc_html( $hitotoki_tel ); ?></a></dd>
					</dl>
				</div>
			</div>
			<?php get_template_part( 'template-parts/map' ); ?>
		</div>
	</section>
</main>

<dialog class="p-lightbox" aria-label="写真の拡大表示">
	<button type="button" aria-label="閉じる">×</button>
	<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" />
	<p></p>
</dialog>
<?php
get_footer();
