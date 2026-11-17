<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Opol Fish Port">
    <title inertia>Opol Fish Port</title>
    <link rel="icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/logo192.png">
    <link rel="manifest" href="/manifest.json">
    @unless (Vite::isRunningHot())
        <link rel="preload" href="{{ Vite::asset('node_modules/typeface-montserrat/files/montserrat-latin-400.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="{{ Vite::asset('node_modules/typeface-montserrat/files/montserrat-latin-600.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="modulepreload" href="{{ Vite::asset('src/pages/'.$page['component'].'.jsx') }}">
    @endunless
    @viteReactRefresh
    @vite('src/main.jsx')
    @inertiaHead
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    @inertia
</body>
</html>
