<?php
/**
 * 管理画面「メニュー」
 *
 * 品目 = 投稿タイプ hitotoki_menu（品名・価格・ひとこと・マーク・トップに表示）
 * 分類 = タクソノミー hitotoki_menu_cat（コーヒー・焼き菓子など。英字の見出し・補足・写真・並び順を持つ）
 * 公開ページは /menu/（archive-hitotoki_menu.php）。品目ごとのページは作らず、/menu/#分類 へ転送する
 */

defined( 'ABSPATH' ) || exit;

const HITOTOKI_MENU     = 'hitotoki_menu';
const HITOTOKI_MENU_CAT = 'hitotoki_menu_cat';

add_action(
	'init',
	function () {
		register_post_type(
			HITOTOKI_MENU,
			array(
				'labels'       => array(
					'name'               => 'メニュー',
					'singular_name'      => 'メニュー',
					'menu_name'          => 'メニュー',
					'all_items'          => 'メニュー一覧',
					'add_new'            => '品目を追加',
					'add_new_item'       => '品目を追加',
					'edit_item'          => '品目を編集',
					'new_item'           => '新しい品目',
					'search_items'       => '品目を検索',
					'not_found'          => '品目がありません',
					'not_found_in_trash' => 'ゴミ箱に品目はありません',
				),
				'public'       => true,
				// 品目ごとのページはないので、サイト内検索・サイトマップには出さない（/menu/ はサイトマップに足す。下の wp_sitemaps_*）
				'exclude_from_search' => true,
				'has_archive'  => 'menu',
				'rewrite'      => array( 'slug' => 'menu', 'with_front' => false ),
				'menu_icon'    => 'dashicons-coffee',
				'menu_position' => 20,
				// 本文は使わない（品名・価格・ひとことだけ）。本文がないのでブロックエディターではなく入力欄だけの画面になる
				'supports'     => array( 'title', 'thumbnail', 'page-attributes' ),
				'show_in_rest' => false,
			)
		);

		register_taxonomy(
			HITOTOKI_MENU_CAT,
			HITOTOKI_MENU,
			array(
				'labels'            => array(
					'name'          => '分類',
					'singular_name' => '分類',
					'all_items'     => 'すべての分類',
					'edit_item'     => '分類を編集',
					'add_new_item'  => '分類を追加',
					'not_found'     => '分類がありません',
				),
				'public'            => false,
				'show_ui'           => true,
				'show_admin_column' => true,
				'hierarchical'      => true, // 編集画面でチェックボックスから選べるようにする
				'rewrite'           => false,
			)
		);
	}
);

// テーマを有効にしたとき、/menu/ の URL のルールを作り直す（しないと「設定 > パーマリンク」を保存するまで 404 になる）
// after_switch_theme は init（優先度 99）の中で呼ばれるので、上の投稿タイプはもう登録されている
add_action( 'after_switch_theme', 'flush_rewrite_rules' );

// ===== 品目の入力欄 =====

/** 品目の項目と初期値 */
function hitotoki_menu_meta( $post_id ) {
	return array(
		'price'    => get_post_meta( $post_id, '_hitotoki_price', true ),
		'prefix'   => get_post_meta( $post_id, '_hitotoki_price_type', true ),
		'desc'     => get_post_meta( $post_id, '_hitotoki_desc', true ),
		'marks'    => (array) get_post_meta( $post_id, '_hitotoki_marks', true ),
		'featured' => (bool) get_post_meta( $post_id, '_hitotoki_featured', true ),
	);
}

/** マーク（品名の横の小さな札） */
const HITOTOKI_MENU_MARKS = array(
	'ice'     => 'ICE可',
	'takeout' => '持ち帰り可',
);

add_action(
	'add_meta_boxes_' . HITOTOKI_MENU,
	function () {
		add_meta_box( 'hitotoki-menu-detail', '価格・ひとこと', 'hitotoki_menu_meta_box', HITOTOKI_MENU, 'normal', 'high' );
	}
);

function hitotoki_menu_meta_box( $post ) {
	$m = hitotoki_menu_meta( $post->ID );
	wp_nonce_field( 'hitotoki_menu_save', 'hitotoki_menu_nonce' );
	?>
	<table class="form-table" role="presentation">
		<tr>
			<th scope="row"><label for="hitotoki-price">価格（税込・円）</label></th>
			<td>
				<input type="number" id="hitotoki-price" name="hitotoki_price" value="<?php echo esc_attr( $m['price'] ); ?>" min="0" step="10" class="small-text" required>
				<select name="hitotoki_price_type" aria-label="価格の書き方">
					<option value="" <?php selected( $m['prefix'], '' ); ?>>そのまま（¥550）</option>
					<option value="from" <?php selected( $m['prefix'], 'from' ); ?>>〜 を付ける（¥550〜）</option>
					<option value="plus" <?php selected( $m['prefix'], 'plus' ); ?>>追加料金（＋¥250）</option>
				</select>
			</td>
		</tr>
		<tr>
			<th scope="row"><label for="hitotoki-desc">ひとこと</label></th>
			<td>
				<input type="text" id="hitotoki-desc" name="hitotoki_desc" value="<?php echo esc_attr( $m['desc'] ); ?>" class="large-text" aria-describedby="hitotoki-desc-help">
				<p class="description" id="hitotoki-desc-help">品名の下に小さく出ます（例: すっきりとして、毎日飲める味）。なくても構いません。</p>
			</td>
		</tr>
		<tr>
			<th scope="row">マーク</th>
			<td>
				<fieldset>
					<legend class="screen-reader-text">マーク</legend>
					<?php foreach ( HITOTOKI_MENU_MARKS as $key => $label ) : ?>
						<label style="margin-right:1.5em"><input type="checkbox" name="hitotoki_marks[]" value="<?php echo esc_attr( $key ); ?>" <?php checked( in_array( $key, $m['marks'], true ) ); ?>> <?php echo esc_html( $label ); ?></label>
					<?php endforeach; ?>
				</fieldset>
			</td>
		</tr>
		<tr>
			<th scope="row">トップページ</th>
			<td>
				<label><input type="checkbox" name="hitotoki_featured" value="1" <?php checked( $m['featured'] ); ?>> トップの「メニュー」に写真つきで出す</label>
				<p class="description">3品までがおすすめです。写真は右の「アイキャッチ画像」に設定してください。並びは「順序」の小さい順です。</p>
			</td>
		</tr>
	</table>
	<?php
}

add_action(
	'save_post_' . HITOTOKI_MENU,
	function ( $post_id ) {
		if ( ! isset( $_POST['hitotoki_menu_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['hitotoki_menu_nonce'] ), 'hitotoki_menu_save' ) ) {
			return;
		}
		if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		$type  = sanitize_key( $_POST['hitotoki_price_type'] ?? '' );
		$marks = array_values( array_intersect( array_map( 'sanitize_key', (array) wp_unslash( $_POST['hitotoki_marks'] ?? array() ) ), array_keys( HITOTOKI_MENU_MARKS ) ) );

		update_post_meta( $post_id, '_hitotoki_price', absint( $_POST['hitotoki_price'] ?? 0 ) );
		update_post_meta( $post_id, '_hitotoki_price_type', in_array( $type, array( 'from', 'plus' ), true ) ? $type : '' );
		update_post_meta( $post_id, '_hitotoki_desc', sanitize_text_field( wp_unslash( $_POST['hitotoki_desc'] ?? '' ) ) );
		update_post_meta( $post_id, '_hitotoki_marks', $marks );
		update_post_meta( $post_id, '_hitotoki_featured', empty( $_POST['hitotoki_featured'] ) ? 0 : 1 );
	}
);

/** 価格の表示（¥550 ／ ¥550〜 ／ ＋¥250） */
function hitotoki_price_label( $post_id ) {
	$m     = hitotoki_menu_meta( $post_id );
	$price = '¥' . number_format( (int) $m['price'] );
	return match ( $m['prefix'] ) {
		'from'  => $price . '〜',
		'plus'  => '＋' . $price,
		default => $price,
	};
}

// ===== 一覧画面（管理画面） =====

add_filter(
	'manage_' . HITOTOKI_MENU . '_posts_columns',
	function ( $cols ) {
		$new = array();
		foreach ( $cols as $key => $label ) {
			$new[ $key ] = $label;
			if ( 'title' === $key ) {
				$new['hitotoki_price'] = '価格';
				$new['hitotoki_top']   = 'トップ';
			}
		}
		unset( $new['date'] );
		return $new;
	}
);

add_action(
	'manage_' . HITOTOKI_MENU . '_posts_custom_column',
	function ( $col, $post_id ) {
		if ( 'hitotoki_price' === $col ) {
			echo esc_html( hitotoki_price_label( $post_id ) );
		} elseif ( 'hitotoki_top' === $col && get_post_meta( $post_id, '_hitotoki_featured', true ) ) {
			echo '<span aria-hidden="true">●</span><span class="screen-reader-text">トップに表示</span>';
		}
	},
	10,
	2
);

// 管理画面の一覧も、公開ページも「順序」の小さい順に並べる。公開ページは全件を 1 ページに出す
add_action(
	'pre_get_posts',
	function ( $q ) {
		if ( HITOTOKI_MENU !== $q->get( 'post_type' ) || ( ! is_admin() && ! $q->is_main_query() ) ) {
			return;
		}
		if ( ! $q->get( 'orderby' ) ) {
			$q->set( 'orderby', array( 'menu_order' => 'ASC', 'title' => 'ASC' ) );
		}
		if ( ! is_admin() ) {
			$q->set( 'posts_per_page', -1 );
		}
	}
);

// 品目ごとのページは作らない。直接開かれたら分類の位置へ転送する
add_action(
	'template_redirect',
	function () {
		if ( ! is_singular( HITOTOKI_MENU ) ) {
			return;
		}
		$terms = get_the_terms( get_queried_object_id(), HITOTOKI_MENU_CAT );
		$hash  = $terms && ! is_wp_error( $terms ) ? '#' . hitotoki_menu_anchor( $terms[0] ) : '';
		wp_safe_redirect( get_post_type_archive_link( HITOTOKI_MENU ) . $hash, 301 );
		exit;
	}
);

// サイトマップ（wp-sitemap.xml）: 品目は外し、メニューページ（/menu/）を 1 件だけの一覧として足す
add_filter(
	'wp_sitemaps_post_types',
	function ( $types ) {
		unset( $types[ HITOTOKI_MENU ] );
		return $types;
	}
);
add_action(
	'init',
	function () {
		if ( ! class_exists( 'WP_Sitemaps_Provider' ) ) {
			return;
		}
		require_once HITOTOKI_DIR . '/inc/class-hitotoki-menu-sitemap.php';
		wp_register_sitemap_provider( 'hitotokimenu', new Hitotoki_Menu_Sitemap() );
	}
);

/** メニューページでの分類の位置（#menu-coffee）。日本語のスラッグでもそのまま使えるようにデコードする */
function hitotoki_menu_anchor( $term ) {
	return 'menu-' . urldecode( $term->slug );
}

// 品目のページはないので、編集画面のパーマリンク欄は出さない（日本語の URL が見えて紛らわしいため）
add_filter(
	'get_sample_permalink_html',
	fn( $html, $post_id ) => HITOTOKI_MENU === get_post_type( $post_id ) ? '' : $html,
	10,
	2
);

// ===== 分類の項目（英字の見出し・補足・写真・並び順） =====

const HITOTOKI_TERM_FIELDS = array(
	'en'    => array( '英字の見出し', '見出しの上に小さく出る英字（例: Coffee）' ),
	'note'  => array( '補足', '品目の下に出る注意書き（例: コーヒーはすべてテイクアウトできます）' ),
	'order' => array( '並び順', '小さい順にメニューページへ並びます' ),
);

/** 分類の項目を読む */
function hitotoki_term_meta( $term_id ) {
	return array(
		'en'    => get_term_meta( $term_id, 'hitotoki_en', true ),
		'note'  => get_term_meta( $term_id, 'hitotoki_note', true ),
		'order' => (int) get_term_meta( $term_id, 'hitotoki_order', true ),
		'image' => (int) get_term_meta( $term_id, 'hitotoki_image', true ),
	);
}

/** 分類の入力欄（追加画面・編集画面で共通） */
function hitotoki_term_fields_html( $meta, $wrap ) {
	wp_nonce_field( 'hitotoki_term_save', 'hitotoki_term_nonce' );
	foreach ( HITOTOKI_TERM_FIELDS as $key => [ $label, $help ] ) {
		$id    = 'hitotoki-term-' . $key;
		$type  = 'order' === $key ? 'number' : 'text';
		$input = sprintf(
			'<input type="%s" id="%s" name="hitotoki_term[%s]" value="%s" aria-describedby="%s-help" %s><p class="description" id="%s-help">%s</p>',
			$type,
			$id,
			$key,
			esc_attr( $meta[ $key ] ?? '' ),
			$id,
			'order' === $key ? 'class="small-text" min="0"' : 'class="large-text"',
			$id,
			esc_html( $help )
		);
		$wrap( $id, $label, $input );
	}
	$image = (int) ( $meta['image'] ?? 0 );
	$input = sprintf(
		'<div class="hitotoki-image-field"><input type="hidden" name="hitotoki_term[image]" value="%d"><div class="hitotoki-image-field__preview">%s</div><p><button type="button" class="button hitotoki-image-field__select" id="hitotoki-term-image">写真を選ぶ</button> <button type="button" class="button-link hitotoki-image-field__remove"%s>写真を外す</button></p><p class="description">メニューページで品目の横に出る写真です。</p></div>',
		$image,
		$image ? wp_get_attachment_image( $image, 'thumbnail' ) : '',
		$image ? '' : ' hidden'
	);
	$wrap( 'hitotoki-term-image', '写真', $input );
}

add_action(
	HITOTOKI_MENU_CAT . '_add_form_fields',
	function () {
		hitotoki_term_fields_html(
			array(),
			function ( $id, $label, $input ) {
				printf( '<div class="form-field"><label for="%s">%s</label>%s</div>', esc_attr( $id ), esc_html( $label ), $input ); // phpcs:ignore WordPress.Security.EscapeOutput -- $input は組み立て時にエスケープ済み
			}
		);
	}
);

add_action(
	HITOTOKI_MENU_CAT . '_edit_form_fields',
	function ( $term ) {
		hitotoki_term_fields_html(
			hitotoki_term_meta( $term->term_id ),
			function ( $id, $label, $input ) {
				printf( '<tr class="form-field"><th scope="row"><label for="%s">%s</label></th><td>%s</td></tr>', esc_attr( $id ), esc_html( $label ), $input ); // phpcs:ignore WordPress.Security.EscapeOutput
			}
		);
	}
);

$hitotoki_save_term = function ( $term_id ) {
	if ( ! isset( $_POST['hitotoki_term_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['hitotoki_term_nonce'] ), 'hitotoki_term_save' ) ) {
		return;
	}
	if ( ! current_user_can( get_taxonomy( HITOTOKI_MENU_CAT )->cap->edit_terms ) ) {
		return;
	}
	$in = (array) wp_unslash( $_POST['hitotoki_term'] ?? array() );
	update_term_meta( $term_id, 'hitotoki_en', sanitize_text_field( $in['en'] ?? '' ) );
	update_term_meta( $term_id, 'hitotoki_note', sanitize_text_field( $in['note'] ?? '' ) );
	update_term_meta( $term_id, 'hitotoki_order', absint( $in['order'] ?? 0 ) );
	$image = absint( $in['image'] ?? 0 );
	update_term_meta( $term_id, 'hitotoki_image', $image && wp_attachment_is_image( $image ) ? $image : 0 );
};
add_action( 'created_' . HITOTOKI_MENU_CAT, $hitotoki_save_term );
add_action( 'edited_' . HITOTOKI_MENU_CAT, $hitotoki_save_term );

// 分類の写真を選ぶボタン（WordPress のメディアライブラリを開く）
add_action(
	'admin_enqueue_scripts',
	function ( $hook ) {
		if ( ! in_array( $hook, array( 'edit-tags.php', 'term.php' ), true ) || HITOTOKI_MENU_CAT !== ( $_GET['taxonomy'] ?? '' ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			return;
		}
		wp_enqueue_media();
		wp_enqueue_script( 'hitotoki-term-image', HITOTOKI_URI . '/assets/js/admin-term-image.js', array( 'jquery' ), HITOTOKI_VERSION, true );
	}
);

/** メニューページ用: 並び順どおりの分類と、それぞれの品目 */
function hitotoki_menu_sections( $posts ) {
	$terms = get_terms(
		array(
			'taxonomy'   => HITOTOKI_MENU_CAT,
			'hide_empty' => true,
		)
	);
	if ( is_wp_error( $terms ) ) {
		return array();
	}
	usort( $terms, fn( $a, $b ) => hitotoki_term_meta( $a->term_id )['order'] <=> hitotoki_term_meta( $b->term_id )['order'] );

	// 品目は最初の分類（並び順がいちばん前のもの）に 1 回だけ出す。分類を付け忘れた品目は最後の「その他」に出す
	$sections = array();
	$placed   = array();
	foreach ( $terms as $term ) {
		$items = array_values( array_filter( $posts, fn( $p ) => ! isset( $placed[ $p->ID ] ) && has_term( $term->term_id, HITOTOKI_MENU_CAT, $p ) ) );
		foreach ( $items as $p ) {
			$placed[ $p->ID ] = true;
		}
		if ( $items ) {
			$sections[] = array(
				'term'  => $term,
				'meta'  => hitotoki_term_meta( $term->term_id ),
				'items' => $items,
			);
		}
	}
	$rest = array_values( array_filter( $posts, fn( $p ) => ! isset( $placed[ $p->ID ] ) ) );
	if ( $rest ) {
		$sections[] = array(
			'term'  => (object) array( 'name' => 'その他', 'slug' => 'other' ),
			'meta'  => array( 'en' => 'Others', 'note' => '', 'order' => PHP_INT_MAX, 'image' => 0 ),
			'items' => $rest,
		);
	}
	return $sections;
}

// 管理画面: 分類のない品目は一覧の「分類」欄に注意を出す（公開ページでは「その他」に入る）
add_action(
	'admin_notices',
	function () {
		$screen = get_current_screen();
		if ( ! $screen || 'edit-' . HITOTOKI_MENU !== $screen->id ) {
			return;
		}
		$orphans = get_posts(
			array(
				'post_type'   => HITOTOKI_MENU,
				'numberposts' => -1,
				'fields'      => 'ids',
				'tax_query'   => array( array( 'taxonomy' => HITOTOKI_MENU_CAT, 'operator' => 'NOT EXISTS' ) ), // phpcs:ignore WordPress.DB.SlowDBQuery
			)
		);
		if ( $orphans ) {
			printf( '<div class="notice notice-warning"><p>分類が選ばれていない品目が %d 件あります。メニューページでは最後の「その他」に出ます。</p></div>', count( $orphans ) );
		}
	}
);
