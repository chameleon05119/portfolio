<?php
/**
 * サイトマップ（wp-sitemap.xml）にメニューページ（/menu/）を 1 件だけ載せる
 * 品目ごとのページはないため、投稿タイプの一覧ではなくこの 1 件にする（inc/menu-items.php で登録）
 */

defined( 'ABSPATH' ) || exit;

class Hitotoki_Menu_Sitemap extends WP_Sitemaps_Provider {
	public function __construct() {
		$this->name        = 'hitotokimenu';
		$this->object_type = 'hitotokimenu';
	}

	public function get_url_list( $page_num, $object_subtype = '' ) {
		return 1 === (int) $page_num ? array( array( 'loc' => get_post_type_archive_link( HITOTOKI_MENU ) ) ) : array();
	}

	public function get_max_num_pages( $object_subtype = '' ) {
		return 1;
	}
}
