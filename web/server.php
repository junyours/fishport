<?php

// Laravel's local PHP server already serves static files. Handle Vite's
// fingerprinted assets here so they receive the same cache policy as Apache.
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

if (in_array($method, ['GET', 'HEAD'], true)
    && is_string($uri)
    && preg_match('#^/build/assets/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}[.]([A-Za-z0-9]+)$#D', $uri, $matches)
) {
    $asset = __DIR__.'/public'.$uri;
    $type = match ($matches[1]) {
        'css' => 'text/css; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg', 'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        default => null,
    };

    if ($type && is_file($asset)) {
        header('Cache-Control: public, max-age=31536000, immutable');
        header('Content-Type: '.$type);
        header('Content-Length: '.filesize($asset));

        if ($method === 'GET') {
            readfile($asset);
        }

        return true;
    }
}

return require __DIR__.'/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php';
