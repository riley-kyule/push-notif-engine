<?php

return [
    'api_url' => env('EPE_API_URL', 'https://api.example.com/api'),
    'site_key' => env('EPE_SITE_KEY'),
    'service_worker_url' => env('EPE_PUSH_SW_URL', '/push-sw.js'),
    'manifest_url' => env('EPE_MANIFEST_URL', '/manifest.json'),
    'app_name' => env('EPE_APP_NAME', config('app.name')),
    'icon_url' => env('EPE_ICON_URL', '/icons/icon-192.png'),
    'theme_color' => env('EPE_THEME_COLOR', '#111111'),
];
