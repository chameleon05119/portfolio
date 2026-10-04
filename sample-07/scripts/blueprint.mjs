// WordPress Playground の起動手順（blueprint）。公開用（dist/blueprint.json）と開発用（scripts/dev.mjs）で共通
// https://wordpress.github.io/wordpress-playground/blueprints/
//
// local: true のときは、テーマと初期データを zip で取りに行かず、開発用にマウントしたフォルダを使う
// login: false にすると自動ログインしない（訪問者の表示や site-check 用）

export function blueprint({ baseUrl = '', local = false, login = true } = {}) {
  const steps = [
    // 管理画面を日本語にする（お店の人が使う画面として見せるため）。開発用は日本語版の WordPress を使うので不要
    ...(local ? [] : [{ step: 'setSiteLanguage', language: 'ja' }]),
    {
      step: 'setSiteOptions',
      options: {
        blogname: 'ひととき珈琲',
        blogdescription: '住宅街の小さな喫茶店',
        blog_public: '0', // デモなので検索エンジンに載せない（noindex）
        timezone_string: 'Asia/Tokyo',
        date_format: 'Y年n月j日',
        time_format: 'H:i',
        start_of_week: '0',
        // お知らせの URL は /news/123/（日本語のタイトルが URL に入らないよう ID を使う）。
        // 初期データより前に設定しておくと、初期データを入れるときにカテゴリ・メニューの URL のルールもそろう
        permalink_structure: '/news/%post_id%/',
        ...(local ? { WPLANG: 'ja' } : {}),
      },
    },
  ]

  if (local) {
    steps.push({ step: 'activateTheme', themeFolderName: 'hitotoki' })
  } else {
    steps.push(
      { step: 'installTheme', themeData: { resource: 'url', url: `${baseUrl}hitotoki.zip` }, options: { activate: true } },
      { step: 'unzip', zipFile: { resource: 'url', url: `${baseUrl}seed.zip` }, extractToPath: '/tmp/seed' },
    )
  }

  steps.push({
    step: 'runPHP',
    code: `<?php require '/wordpress/wp-load.php'; require '${local ? '/seed' : '/tmp/seed'}/seed.php';`,
  })

  return {
    $schema: 'https://playground.wordpress.net/blueprint-schema.json',
    meta: {
      title: 'ひととき珈琲（WordPress テーマのデモ）',
      author: 'chameleon05119',
      description: '架空の喫茶店のクラシックテーマ。お知らせ・メニュー・営業時間を管理画面から更新できます。',
    },
    landingPage: '/',
    preferredVersions: { php: '8.3', wp: 'latest' },
    login,
    steps,
  }
}
