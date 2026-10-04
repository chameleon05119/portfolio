<?php
/**
 * 管理画面「お店の情報」
 *
 * 営業時間・定休日・臨時休業・住所などを 1 つのオプション（hitotoki_shop）にまとめて保存する。
 * 表示側は hitotoki_shop( 'キー' ) で読む。トップの「本日の営業」とカレンダーは、ここの値を JS に渡して判定する
 */

defined( 'ABSPATH' ) || exit;

const HITOTOKI_SHOP_OPTION = 'hitotoki_shop';

/** 初期値（テーマを入れた直後もこの内容で表示される） */
function hitotoki_shop_defaults() {
	return array(
		'open'          => '08:00',
		'close'         => '18:00',
		'last_order'    => '17:30',
		'closed_days'   => array( 3 ), // 0=日 … 6=土
		'closed_nth'    => array( array( 'nth' => 3, 'day' => 4 ) ), // 第3木曜
		'closed_dates'  => "2026-12-30〜2027-01-03\n",
		'open_dates'    => '',
		'postal'        => '000-0000',
		'address'       => '〇〇県〇〇市ひだまり町 1-2-3',
		'access'        => '〇〇駅 南口から徒歩6分',
		'parking'       => '2台（店の前）',
		'tel'           => '000-000-0000',
		'reservation'   => '不要です（6名以上はお電話で）',
		'payment'       => '現金・クレジットカード・QR決済',
		'instagram'     => 'https://www.instagram.com/',
	);
}

/** 保存値と初期値を合わせた配列 */
function hitotoki_shop_all() {
	$saved = get_option( HITOTOKI_SHOP_OPTION, array() );
	return array_merge( hitotoki_shop_defaults(), is_array( $saved ) ? $saved : array() );
}

/** 1 項目を読む */
function hitotoki_shop( $key ) {
	$all = hitotoki_shop_all();
	return $all[ $key ] ?? '';
}

const HITOTOKI_WEEKDAYS = array( '日', '月', '火', '水', '木', '金', '土' );

/** "08:00" → "8:00" */
function hitotoki_time_label( $time ) {
	return ltrim( substr( $time, 0, 2 ), '0' ) . substr( $time, 2 );
}

/** 営業時間の表示（例: 8:00 – 18:00） */
function hitotoki_hours_label() {
	return hitotoki_time_label( hitotoki_shop( 'open' ) ) . ' – ' . hitotoki_time_label( hitotoki_shop( 'close' ) );
}

/** 定休日の表示（例: 水曜・第3木曜）。設定から組み立てるので、曜日を変えれば全ページの表記が変わる */
function hitotoki_closed_label() {
	$parts = array();
	foreach ( (array) hitotoki_shop( 'closed_days' ) as $day ) {
		$parts[] = HITOTOKI_WEEKDAYS[ (int) $day ] . '曜';
	}
	foreach ( (array) hitotoki_shop( 'closed_nth' ) as $rule ) {
		$parts[] = '第' . (int) $rule['nth'] . HITOTOKI_WEEKDAYS[ (int) $rule['day'] ] . '曜';
	}
	return $parts ? implode( '・', $parts ) : 'なし';
}

/**
 * 臨時休業・臨時営業の入力（1 行に 1 日、または「開始〜終了」）を日付の配列にする
 * 例: "2026-12-30〜2027-01-03" → 2026-12-30, 2026-12-31, … 2027-01-03
 */
function hitotoki_parse_dates( $text ) {
	$dates = array();
	foreach ( preg_split( '/\R/', (string) $text ) as $line ) {
		if ( ! preg_match_all( '/\d{4}-\d{2}-\d{2}/', $line, $m ) ) {
			continue;
		}
		// 2026-02-31 のような存在しない日は、繰り上げずに読み飛ばす
		$date  = function ( $ymd ) {
			$d = DateTimeImmutable::createFromFormat( '!Y-m-d', $ymd );
			return $d && $d->format( 'Y-m-d' ) === $ymd ? $d : null;
		};
		$start = $date( $m[0][0] );
		$end   = $date( $m[0][1] ?? $m[0][0] );
		if ( ! $start || ! $end || $end < $start ) {
			continue;
		}
		// 入力ミスで何年分も展開しないよう、1 行あたり 62 日までにする
		for ( $d = $start, $i = 0; $d <= $end && $i < 62; $d = $d->modify( '+1 day' ), $i++ ) {
			$dates[] = $d->format( 'Y-m-d' );
		}
	}
	return array_values( array_unique( $dates ) );
}

/** JS（本日の営業・カレンダー）に渡す設定 */
function hitotoki_shop_script_config() {
	$to_min = fn( $t ) => (int) substr( $t, 0, 2 ) * 60 + (int) substr( $t, 3, 2 );
	return array(
		'open'       => $to_min( hitotoki_shop( 'open' ) ),
		'close'      => $to_min( hitotoki_shop( 'close' ) ),
		'openLabel'  => hitotoki_time_label( hitotoki_shop( 'open' ) ),
		'closedDays' => array_map( 'intval', (array) hitotoki_shop( 'closed_days' ) ),
		'closedNth'  => array_values( (array) hitotoki_shop( 'closed_nth' ) ),
		'closed'     => hitotoki_parse_dates( hitotoki_shop( 'closed_dates' ) ),
		'opened'     => hitotoki_parse_dates( hitotoki_shop( 'open_dates' ) ),
	);
}

// ===== 管理画面 =====

// お店のスタッフ（編集者）でも更新できるよう、管理者権限ではなく「固定ページの編集」権限にする
const HITOTOKI_SHOP_CAP = 'edit_pages';
add_filter( 'option_page_capability_' . HITOTOKI_SHOP_OPTION, fn() => HITOTOKI_SHOP_CAP );

add_action(
	'admin_init',
	function () {
		register_setting(
			HITOTOKI_SHOP_OPTION,
			HITOTOKI_SHOP_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => 'hitotoki_shop_sanitize',
				// 初期値は hitotoki_shop_all() で足すので、ここでは持たない
			)
		);
	}
);

add_action(
	'admin_menu',
	function () {
		add_menu_page( 'お店の情報', 'お店の情報', HITOTOKI_SHOP_CAP, 'hitotoki-shop', 'hitotoki_shop_page', 'dashicons-store', 21 );
	}
);

/** 保存前の検証。時刻・曜日は形式を確かめ、文字は HTML を落とす */
function hitotoki_shop_sanitize( $input ) {
	$out      = array();
	$input    = is_array( $input ) ? $input : array();

	// 形式が違う時刻は、いま保存されている値のままにする
	foreach ( array( 'open', 'close', 'last_order' ) as $key ) {
		$value       = $input[ $key ] ?? '';
		$out[ $key ] = is_string( $value ) && preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', $value ) ? $value : hitotoki_shop( $key );
	}
	// 初回の保存では WordPress がこの関数を 2 回呼ぶので、同じエラーを重ねて出さない
	$error = function ( $code, $message ) {
		$codes = wp_list_pluck( get_settings_errors( HITOTOKI_SHOP_OPTION ), 'code' );
		if ( ! in_array( $code, $codes, true ) ) {
			add_settings_error( HITOTOKI_SHOP_OPTION, $code, $message );
		}
	};
	if ( $out['close'] <= $out['open'] ) {
		$error( 'hours', '閉店時刻は開店時刻より後にしてください。営業時間は変更していません。' );
		$out['open']  = hitotoki_shop( 'open' );
		$out['close'] = hitotoki_shop( 'close' );
	}
	if ( $out['last_order'] <= $out['open'] || $out['last_order'] > $out['close'] ) {
		$error( 'last_order', 'ラストオーダーは営業時間の中にしてください。ラストオーダーは変更していません。' );
		$out['last_order'] = hitotoki_shop( 'last_order' );
	}

	$out['closed_days'] = array_values( array_filter( array_map( 'intval', (array) ( $input['closed_days'] ?? array() ) ), fn( $d ) => $d >= 0 && $d <= 6 ) );

	$out['closed_nth'] = array();
	foreach ( (array) ( $input['closed_nth'] ?? array() ) as $rule ) {
		$nth = (int) ( $rule['nth'] ?? 0 );
		$day = (int) ( $rule['day'] ?? -1 );
		if ( $nth >= 1 && $nth <= 5 && $day >= 0 && $day <= 6 ) {
			$out['closed_nth'][] = array( 'nth' => $nth, 'day' => $day );
		}
	}

	// 文字列以外（改ざんされた送信）は空にする。options.php で unslash 済み
	$text = fn( $key ) => is_string( $input[ $key ] ?? null ) ? $input[ $key ] : '';
	foreach ( array( 'closed_dates', 'open_dates' ) as $key ) {
		$out[ $key ] = sanitize_textarea_field( $text( $key ) );
	}
	foreach ( array( 'postal', 'address', 'access', 'parking', 'tel', 'reservation', 'payment' ) as $key ) {
		$out[ $key ] = sanitize_text_field( $text( $key ) );
	}
	$out['instagram'] = esc_url_raw( $text( 'instagram' ) );

	return $out;
}

/** 管理画面「お店の情報」の画面 */
function hitotoki_shop_page() {
	$s    = hitotoki_shop_all();
	$name = fn( $key ) => esc_attr( HITOTOKI_SHOP_OPTION . '[' . $key . ']' );
	$nth  = array_pad( (array) $s['closed_nth'], 2, array( 'nth' => 0, 'day' => 0 ) );
	?>
	<div class="wrap">
		<h1>お店の情報</h1>
		<p>ここで変えた内容は、トップの「本日の営業」・営業カレンダー・アクセス欄・フッターにまとめて反映されます。</p>
		<?php settings_errors(); // 「設定を保存しました」と入力エラーを出す（独自の管理ページでは自動で出ないため） ?>
		<form method="post" action="options.php">
			<?php settings_fields( HITOTOKI_SHOP_OPTION ); ?>

			<h2 class="title">営業時間</h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">営業時間</th>
					<td>
						<label><input type="time" name="<?php echo $name( 'open' ); ?>" value="<?php echo esc_attr( $s['open'] ); ?>" required> から</label>
						<label><input type="time" name="<?php echo $name( 'close' ); ?>" value="<?php echo esc_attr( $s['close'] ); ?>" required> まで</label>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="hitotoki-lo">ラストオーダー</label></th>
					<td><input type="time" id="hitotoki-lo" name="<?php echo $name( 'last_order' ); ?>" value="<?php echo esc_attr( $s['last_order'] ); ?>"></td>
				</tr>
			</table>

			<h2 class="title">定休日</h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">毎週のお休み</th>
					<td>
						<fieldset>
							<legend class="screen-reader-text">毎週のお休み</legend>
							<?php foreach ( HITOTOKI_WEEKDAYS as $i => $w ) : ?>
								<label style="margin-right:1em"><input type="checkbox" name="<?php echo $name( 'closed_days' ); ?>[]" value="<?php echo (int) $i; ?>" <?php checked( in_array( $i, array_map( 'intval', (array) $s['closed_days'] ), true ) ); ?>> <?php echo esc_html( $w ); ?></label>
							<?php endforeach; ?>
						</fieldset>
					</td>
				</tr>
				<tr>
					<th scope="row">毎月のお休み</th>
					<td>
						<?php foreach ( $nth as $i => $rule ) : ?>
							<p>
								<label class="screen-reader-text" for="hitotoki-nth-<?php echo (int) $i; ?>">何週目（<?php echo (int) $i + 1; ?>つ目）</label>
								<select id="hitotoki-nth-<?php echo (int) $i; ?>" name="<?php echo $name( 'closed_nth' ); ?>[<?php echo (int) $i; ?>][nth]">
									<option value="0">なし</option>
									<?php for ( $n = 1; $n <= 5; $n++ ) : ?>
										<option value="<?php echo (int) $n; ?>" <?php selected( (int) $rule['nth'], $n ); ?>>第<?php echo (int) $n; ?></option>
									<?php endfor; ?>
								</select>
								<label class="screen-reader-text" for="hitotoki-nth-day-<?php echo (int) $i; ?>">曜日（<?php echo (int) $i + 1; ?>つ目）</label>
								<select id="hitotoki-nth-day-<?php echo (int) $i; ?>" name="<?php echo $name( 'closed_nth' ); ?>[<?php echo (int) $i; ?>][day]">
									<?php foreach ( HITOTOKI_WEEKDAYS as $d => $w ) : ?>
										<option value="<?php echo (int) $d; ?>" <?php selected( (int) $rule['day'], $d ); ?>><?php echo esc_html( $w ); ?>曜</option>
									<?php endforeach; ?>
								</select>
							</p>
						<?php endforeach; ?>
						<p class="description">例: 第3木曜。使わないときは「なし」。</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="hitotoki-closed">臨時休業</label></th>
					<td>
						<textarea id="hitotoki-closed" class="large-text code" rows="4" name="<?php echo $name( 'closed_dates' ); ?>" aria-describedby="hitotoki-closed-desc"><?php echo esc_textarea( $s['closed_dates'] ); ?></textarea>
						<p class="description" id="hitotoki-closed-desc">1行に1日（例: 2026-11-03）、または期間（例: 2026-12-30〜2027-01-03）。過ぎた日付は消して構いません。</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="hitotoki-opened">臨時営業</label></th>
					<td>
						<textarea id="hitotoki-opened" class="large-text code" rows="2" name="<?php echo $name( 'open_dates' ); ?>" aria-describedby="hitotoki-opened-desc"><?php echo esc_textarea( $s['open_dates'] ); ?></textarea>
						<p class="description" id="hitotoki-opened-desc">定休日だけど営業する日。書き方は臨時休業と同じです。</p>
					</td>
				</tr>
			</table>

			<h2 class="title">お店の場所・ご案内</h2>
			<table class="form-table" role="presentation">
				<?php
				$fields = array(
					'postal'      => '郵便番号',
					'address'     => '住所',
					'access'      => 'アクセス',
					'parking'     => '駐車場',
					'tel'         => '電話番号',
					'reservation' => 'ご予約',
					'payment'     => 'お支払い',
				);
				foreach ( $fields as $key => $label ) :
					?>
					<tr>
						<th scope="row"><label for="hitotoki-<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></label></th>
						<td><input type="text" class="regular-text" id="hitotoki-<?php echo esc_attr( $key ); ?>" name="<?php echo $name( $key ); ?>" value="<?php echo esc_attr( $s[ $key ] ); ?>"></td>
					</tr>
				<?php endforeach; ?>
				<tr>
					<th scope="row"><label for="hitotoki-instagram">Instagram の URL</label></th>
					<td><input type="url" class="regular-text code" id="hitotoki-instagram" name="<?php echo $name( 'instagram' ); ?>" value="<?php echo esc_attr( $s['instagram'] ); ?>"></td>
				</tr>
			</table>

			<?php submit_button( '保存する' ); ?>
		</form>
	</div>
	<?php
}
