#!/usr/bin/env sh
# damasare-lab.html（ページ本体の断片）から、GitHub Pages 用の完全な index.html を作る。
# 使い方：リポジトリのルートで  sh tools/build.sh
set -e
cd "$(dirname "$0")/.."
URL="https://azakeiten.github.io/damasare-lab/"
DESC="30本の分岐ストーリーで、副業・投資・闇バイト・推し活・当選詐欺・偽通販・家族を名のる電話などに「気づくサイン」を体験的に学ぶ。AZAKEI（麻経）制作。"
{
  cat <<EOF
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="$DESC">
<meta name="theme-color" content="#F1F4F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0D131A" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="だまされ体験ラボ">
<meta property="og:title" content="だまされ体験ラボ｜その誘い、どこで見抜ける？">
<meta property="og:description" content="$DESC">
<meta property="og:url" content="$URL">
<meta property="og:image" content="${URL}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="$URL">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='28' fill='%23FFC21A' stroke='%231B2534' stroke-width='4'/%3E%3Cellipse cx='23' cy='36' rx='4' ry='5' fill='%231B2534'/%3E%3Cellipse cx='41' cy='36' rx='4' ry='5' fill='%231B2534'/%3E%3C/svg%3E">
<style>html{color-scheme:light dark}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
EOF
  cat damasare-lab.html
  printf '\n</html>\n'
} > index.html
echo "index.html を作成しました"
