// Builds src/web/public/app.css for index.html (run: npm run css:build after changing classes)
module.exports = {
  content: ['./src/web/public/index.html', './src/web/public/app.js', './src/web/public/study.js', './src/web/public/account.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Bengali"', '"Kalpurush"', '"SolaimanLipi"', 'sans-serif'],
        serif: ['"Tiro Bangla"', '"SolaimanLipi"', '"Kalpurush"', '"Noto Serif Bengali"', 'serif'],
        mono: ['"JetBrains Mono"', '"Noto Sans Bengali"', 'monospace']
      },
      colors: {
        emerald: {
          50: '#eef7f3', 100: '#d6ece2', 200: '#acd8c5', 300: '#78bd9f', 400: '#3f9c79',
          500: '#13805d', 600: '#006a4e', 700: '#00573f', 800: '#004532', 900: '#003426', 950: '#00221a'
        },
        bcs: { 50: '#f0fdf4', 100: '#dcfce7', 600: '#006a4e', 700: '#00563f', 800: '#004230', 900: '#002e21' }
      }
    }
  }
};
