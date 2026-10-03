// プロフィールと依頼先。URL が null のリンクは表示しない（登録が済んだら URL を入れる）
export const profile = {
  name: 'カメレオンワークス',
  nameEn: 'Chameleon Works',
  description: 'Web コーディング・サイト制作の作品集（ポートフォリオ）',
  bio: 'EC 企業でフロントエンド開発を3年半（Vue.js での画面開発、表示速度の改善、GA4 による計測）。現在は同じ EC サイトの UI/UX 改善を担当しています。いただいたデザインを、カンプとの差を確かめながら忠実に組み上げます。福岡在住。',
  stack: ['HTML', 'SCSS', 'JavaScript', 'Vue.js', 'Astro', 'GA4'],
  links: [
    { label: 'クラウドワークスで相談する', url: null, primary: true },
    { label: 'ココナラ', url: null },
    { label: 'GitHub', url: 'https://github.com/chameleon05119' },
  ],
};
